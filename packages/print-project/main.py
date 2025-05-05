#!/usr/bin/env python3

# print-project/main.py

"""
This script generates a markdown representation of the project structure,
including file contents, based on a configuration file.

It supports:
- Directory and file inclusion/exclusion patterns
- File content inclusion
- Tree depth limit
- Output file path
- UTF-8 and Latin-1 file encoding support
- Error handling and logging
"""

import sys
from pathlib import Path
import fnmatch
import os
from typing import List, Dict, Any, Tuple

try:
    import tomllib
except ImportError:
    try:
        import tomli as tomllib
    except ImportError:
        print("ERROR: 'tomli' package not found. Please install it (`pip install tomli`) for Python < 3.11.", file=sys.stderr)
        sys.exit(1)


def resolve_path(path_str: str, base_dir: Path) -> Path:
    """Resolves a path string relative to a base directory, handling absolute."""
    path_obj = Path(path_str)
    return path_obj.resolve() if path_obj.is_absolute() else (base_dir / path_str).resolve()

def is_match(path: str, patterns: List[str]) -> bool:
    """Checks if a path string matches any fnmatch patterns."""
    if not path or not patterns:
        return False
    path_with_slash = path if path.endswith('/') else path + '/'
    return any(fnmatch.fnmatch(path, p) or fnmatch.fnmatch(path_with_slash, p) for p in patterns)

def load_config(config_path: str) -> Dict[str, Any]:
    """Loads and validates TOML configuration."""
    config_path = Path(config_path).resolve()
    if not config_path.is_file():
        print(f"ERROR: Config file not found: '{config_path}'", file=sys.stderr)
        sys.exit(1)

    try:
        with open(config_path, "rb") as f:
            config = tomllib.load(f)
    except Exception as e:
        print(f"ERROR: Failed to parse config '{config_path}': {e}", file=sys.stderr)
        sys.exit(1)

    if not config.get("project", {}).get("root"):
        print("ERROR: Config missing [project].root", file=sys.stderr)
        sys.exit(1)
    if not config.get("output", {}).get("file"):
        print("ERROR: Config missing [output].file", file=sys.stderr)
        sys.exit(1)

    config.setdefault("tree", {})
    config["tree"].setdefault("ignore", [])
    config["tree"].setdefault("include", [])
    config["tree"].setdefault("depth", None)
    config.setdefault("content", {})
    config["content"].setdefault("include_files", [])

    depth = config["tree"]["depth"]
    if depth is not None:
        try:
            depth = int(depth)
            config["tree"]["depth"] = depth if depth >= 0 else None
        except ValueError:
            print("WARNING: Invalid tree.depth value, ignoring depth limit.", file=sys.stderr)
            config["tree"]["depth"] = None

    return config

def generate_tree(
    config: Dict[str, Any],
    config_dir: Path
) -> Tuple[str, Path]:
    project_root = resolve_path(config["project"]["root"], config_dir)
    output_path = resolve_path(config["output"]["file"], project_root)

    if not project_root.is_dir():
        print(f"ERROR: Project root is not a valid directory: {project_root}", file=sys.stderr)
        sys.exit(1)

    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        print(f"ERROR: Cannot create output directory {output_path.parent}: {e}", file=sys.stderr)
        sys.exit(1)

    ignore_patterns = config["tree"]["ignore"]
    include_patterns = config["tree"]["include"]
    content_patterns = config["content"]["include_files"]
    max_depth = config["tree"]["depth"]

    try:
        output_rel = str(output_path.relative_to(project_root))
        if not is_match(output_rel, ignore_patterns):
            ignore_patterns.append(output_rel)
    except ValueError:
        pass  # Output is outside project root

    print("Scanning project directory...")
    file_tree = {}
    content_files = []

    force_include_dirs = set()

    for include_pattern in include_patterns:
        if include_pattern.endswith('/'):
            print(f"Processing directory include pattern: {include_pattern}")
            for root, dirs, _ in os.walk(project_root):
                root_path = Path(root)
                try:
                    rel_root = str(root_path.relative_to(project_root))
                    rel_root = '.' if rel_root == '' else rel_root

                    if fnmatch.fnmatch(f"{rel_root}/", include_pattern) or rel_root == include_pattern.rstrip('/'):
                        print(f"Found matching directory for inclusion: {rel_root}")
                        force_include_dirs.add(rel_root)
                except ValueError:
                    continue

    for root, dirs, files in os.walk(project_root):
        root_path = Path(root)
        rel_root = str(root_path.relative_to(project_root))
        rel_root = '.' if rel_root == '' else rel_root

        depth = 0 if rel_root == '.' else rel_root.count(os.sep) + 1
        if max_depth is not None and depth > max_depth:
            dirs.clear()  # Stop descending
            continue

        parent_forced = False
        parent_path = root_path.parent
        try:
            parent_rel = str(parent_path.relative_to(project_root))
            parent_rel = '.' if parent_rel == '' else parent_rel
            parent_forced = parent_rel in force_include_dirs
        except ValueError:
            pass

        if rel_root != '.':
            if is_match(rel_root, ignore_patterns):
                dirs.clear()  # Skip all subdirectories too
                continue

            dir_forced = rel_root in force_include_dirs or is_match(rel_root, include_patterns)
            if dir_forced and rel_root not in force_include_dirs:
                force_include_dirs.add(rel_root)
        else:
            dir_forced = False

        if rel_root not in file_tree:
            file_tree[rel_root] = {'type': 'dir', 'children': [], 'visible': dir_forced or parent_forced}

        for file in sorted(files):
            file_path = root_path / file
            rel_path = str(file_path.relative_to(project_root))

            if is_match(rel_path, ignore_patterns):
                continue

            file_included = is_match(rel_path, include_patterns)
            file_has_content = is_match(rel_path, content_patterns)
            file_visible = file_included or file_has_content or dir_forced or parent_forced

            if file_visible:
                file_tree[rel_root]['children'].append({
                    'name': file,
                    'type': 'file',
                    'has_content': file_has_content
                })

                if file_has_content:
                    content_files.append(file_path)
                    curr = rel_root
                    while curr != '.':
                        if curr in file_tree:
                            file_tree[curr]['visible'] = True
                        path_obj = Path(curr)
                        curr = str(path_obj.parent)
                        if curr == '':
                            curr = '.'
                    file_tree['.']['visible'] = True

        dirs.sort()

    for dir_path in force_include_dirs:
        if dir_path in file_tree:
            file_tree[dir_path]['visible'] = True

            curr = str(Path(dir_path).parent)
            curr = '.' if curr == '' else curr
            while curr != '.':
                if curr in file_tree:
                    file_tree[curr]['visible'] = True
                path_obj = Path(curr)
                curr = str(path_obj.parent)
                if curr == '':
                    curr = '.'
            file_tree['.']['visible'] = True

    tree_lines = [project_root.name]

    def build_tree_output(dir_path: str, prefix: str = ""):
        if dir_path not in file_tree or not file_tree[dir_path]['visible']:
            return

        children = file_tree[dir_path]['children']

        subdirs = []
        for subdir in sorted(file_tree.keys()):
            if subdir == '.':
                continue

            parent = str(Path(subdir).parent)
            parent = '.' if parent == '' else parent

            if parent == dir_path and file_tree[subdir]['visible']:
                subdirs.append((Path(subdir).name, subdir))

        all_items = []
        all_items.extend([(child['name'], None, child['type'] == 'file') for child in children])
        all_items.extend([(name, path, False) for name, path in subdirs])
        all_items.sort(key=lambda x: (x[2], x[0].lower()))  # Sort dirs first, then by name

        for i, (name, subdir_path, is_file) in enumerate(all_items):
            is_last = i == len(all_items) - 1
            connector = "└── " if is_last else "├── "
            tree_lines.append(f"{prefix}{connector}{name}")

            if not is_file and subdir_path:
                next_prefix = prefix + ("    " if is_last else "│   ")
                build_tree_output(subdir_path, next_prefix)

    build_tree_output(".")
    tree_text = "\n".join(tree_lines)

    content_blocks = []
    for file_path in sorted(content_files, key=lambda p: str(p.relative_to(project_root))):
        rel_path = file_path.relative_to(project_root)
        print(f"Reading: {rel_path}")

        try:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
            except UnicodeDecodeError:
                with open(file_path, "r", encoding="latin-1") as f:
                    content = f.read() + "\n[Warning: Read using latin-1 encoding]"

            lang = file_path.suffix[1:].lower() if file_path.suffix else 'text'
            content_blocks.append(f"### `{rel_path}`\n```{lang}\n{content}\n```")
        except Exception as e:
            content_blocks.append(f"### `{rel_path}`\n[Error reading file: {e}]")

    output = f"```\n{tree_text}\n```"
    if content_blocks:
        output += "\n\n---\n\n## File Contents\n\n" + "\n\n".join(content_blocks)

    return output, output_path

def main():
    if len(sys.argv) != 2:
        print(f"Usage: python {sys.argv[0]} <config.toml>")
        sys.exit(1)

    config_file = sys.argv[1]
    config_dir = Path(config_file).parent

    try:
        config = load_config(config_file)
        output, output_path = generate_tree(config, config_dir)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"Documentation successfully written to: {output_path}")
    except Exception as e:
        print(f"FATAL ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
