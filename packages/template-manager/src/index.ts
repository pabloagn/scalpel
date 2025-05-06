// packages/template-manager/src/index.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

interface SpawnConfig {
  template: string;
  name: string;
  features: string[];
  repo: string;
  path: string;
}

interface ScalpelConfig {
  version: string;
  templates: {
    repositories: Record<string, string>;
    available: Record<string, TemplateConfig>;
  };
  features: Record<string, FeatureConfig>;
  workspace: WorkspaceConfig;
}

interface TemplateConfig {
  path: string;
  category: string;
  description: string;
  features: string[];
  repository: string;
}

interface FeatureConfig {
  description: string;
  files: Record<string, any>;
  vscode_settings?: Record<string, any>;
  required_extensions?: string[];
}

interface WorkspaceConfig {
  defaultExtensions: string[];
  settings: Record<string, any>;
}

export async function spawn(config: SpawnConfig) {
  const fullRepo = `${config.repo}/${config.path}`;
  const projectDir = path.resolve(config.name);
  
  console.log(`🚀 Creating project "${config.name}" from template "${config.template}"`);
  
  try {
    // 1. Clone template using degit
    console.log(`📥 Cloning template from ${fullRepo}...`);
    await execAsync(`npx degit ${fullRepo} ${config.name}`);
    
    // 2. Load scalpel configuration
    const scalpelConfig = await loadScalpelConfig();
    
    // 3. Initialize project metadata
    await initializeProject(projectDir, config, scalpelConfig);
    
    // 4. Apply all features
    const allFeatures = new Set([
      ...config.features,
      ...scalpelConfig.templates.available[config.template].features
    ]);
    
    const mergedVSCodeSettings: Record<string, any> = {};
    const mergedExtensions: string[] = [...scalpelConfig.workspace.defaultExtensions];
    
    for (const feature of allFeatures) {
      await applyFeature(projectDir, feature, scalpelConfig);
      
      // Merge feature settings
      const featureConfig = scalpelConfig.features[feature];
      if (featureConfig?.vscode_settings) {
        Object.assign(mergedVSCodeSettings, featureConfig.vscode_settings);
      }
      
      if (featureConfig?.required_extensions) {
        mergedExtensions.push(...featureConfig.required_extensions);
      }
    }
    
    // 5. Create VS Code workspace with all merged settings
    if (allFeatures.has('vscode')) {
      await createVSCodeWorkspace(
        projectDir, 
        config, 
        scalpelConfig,
        mergedVSCodeSettings,
        [...new Set(mergedExtensions)] // Remove duplicates
      );
    }
    
    // 6. Initialize git repository
    await execAsync(`cd ${config.name} && git init`);
    
    // 7. Run post-setup hooks
    await runPostSetup(projectDir);
    
    console.log(`✅ Project "${config.name}" created successfully!`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${config.name}`);
    
    if (allFeatures.has('vscode')) {
      console.log(`  code ${config.name}.code-workspace`);
    } else {
      console.log(`  code .`);
    }
    
    if (allFeatures.has('poetry')) {
      console.log(`  poetry install`);
    } else if (allFeatures.has('nextjs')) {
      console.log(`  pnpm install`);
      console.log(`  pnpm dev`);
    }
    
  } catch (error) {
    console.error(`❌ Error creating project:`, error);
    throw error;
  }
}

async function loadScalpelConfig(): Promise<ScalpelConfig> {
  const configPath = path.join(process.cwd(), 'scalpel.config.json');
  const content = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(content);
}

async function initializeProject(
  projectDir: string, 
  config: SpawnConfig,
  scalpelConfig: ScalpelConfig
) {
  // Process template variables
  const templateVars: Record<string, string> = {
    '{{project_name}}': config.name,
    '{{package_name}}': config.name.replace(/-/g, '_'),
    '{{project_description}}': scalpelConfig.templates.available[config.template].description,
    '{{author_name}}': process.env.GIT_AUTHOR_NAME || 'Your Name',
    '{{author_email}}': process.env.GIT_AUTHOR_EMAIL || 'you@example.com',
  };
  
  await processTemplateFiles(projectDir, templateVars);
}

async function processTemplateFiles(
  directory: string, 
  variables: Record<string, string>
) {
  async function processFile(filePath: string) {
    try {
      let content = await fs.readFile(filePath, 'utf-8');
      
      // Replace template variables
      for (const [key, value] of Object.entries(variables)) {
        content = content.replace(new RegExp(key, 'g'), value);
      }
      
      await fs.writeFile(filePath, content);
    } catch (error) {
      // Skip files that can't be read as text
      if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
        // Silent skip
      }
    }
  }
  
  async function walkDirectory(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Recursive directory processing
        await walkDirectory(fullPath);
      } else if (entry.isFile()) {
        await processFile(fullPath);
      }
    }
  }
  
  await walkDirectory(directory);
}

async function applyFeature(
  projectDir: string, 
  feature: string, 
  config: ScalpelConfig
) {
  console.log(`⚡ Applying feature: ${feature}`);
  
  const featureConfig = config.features[feature];
  if (!featureConfig) {
    console.warn(`Feature "${feature}" not found in config`);
    return;
  }
  
  // Create feature files
  for (const [filePath, content] of Object.entries(featureConfig.files)) {
    const fullPath = path.join(projectDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    if (content === null) {
      // Create empty file
      await fs.writeFile(fullPath, '');
    } else if (typeof content === 'string') {
      await fs.writeFile(fullPath, content);
    } else if (Array.isArray(content)) {
      // For files like .gitignore
      await fs.writeFile(fullPath, content.join('\n'));
    } else {
      // For JSON files
      await fs.writeFile(fullPath, JSON.stringify(content, null, 2));
    }
  }
}

async function createVSCodeWorkspace(
  projectDir: string, 
  projectConfig: SpawnConfig,
  scalpelConfig: ScalpelConfig,
  mergedSettings: Record<string, any>,
  mergedExtensions: string[]
) {
  const workspaceName = `${projectConfig.name}.code-workspace`;
  const workspacePath = path.join(projectDir, workspaceName);
  
  // Create workspace structure
  const workspace = {
    folders: [
      { path: ".", name: projectConfig.name }
    ],
    settings: {
      ...scalpelConfig.workspace.settings,
      ...mergedSettings,
      "files.exclude": {
        ...scalpelConfig.workspace.settings["files.exclude"],
        // Add template-specific excludes
      },
      "search.exclude": {
        ...scalpelConfig.workspace.settings["search.exclude"],
        // Add template-specific search excludes
      }
    },
    extensions: {
      recommendations: mergedExtensions
    }
  };
  
  // Write workspace file
  await fs.writeFile(workspacePath, JSON.stringify(workspace, null, 2));
  console.log(`📁 Created VS Code workspace: ${workspaceName}`);
}

async function runPostSetup(projectDir: string) {
  // Install dependencies based on detected package managers
  if (await fileExists(path.join(projectDir, 'package.json'))) {
    console.log('📦 Installing Node dependencies...');
    await execAsync(`cd ${projectDir} && pnpm install`);
  }
  
  if (await fileExists(path.join(projectDir, 'pyproject.toml'))) {
    console.log('🐍 Installing Python dependencies...');
    await execAsync(`cd ${projectDir} && poetry install`);
  }
  
  // Setup pre-commit hooks if available
  if (await fileExists(path.join(projectDir, '.pre-commit-config.yaml'))) {
    console.log('🪝 Installing pre-commit hooks...');
    await execAsync(`cd ${projectDir} && poetry run pre-commit install`);
  }
  
  // Initialize git and make first commit
  try {
    await execAsync(`cd ${projectDir} && git add .`);
    await execAsync(`cd ${projectDir} && git commit -m "Initial commit from scalpel template"`);
    console.log('📝 Created initial git commit');
  } catch (error) {
    console.log('⚠️  Could not create initial commit');
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Export additional utility functions
export async function listTemplates() {
  const config = await loadScalpelConfig();
  
  console.log('\nAvailable templates:');
  console.log('--------------------');
  
  const categories = new Map<string, string[]>();
  
  // Group templates by category
  for (const [name, template] of Object.entries(config.templates.available)) {
    if (!categories.has(template.category)) {
      categories.set(template.category, []);
    }
    categories.get(template.category)!.push(name);
  }
  
  // Display categorized templates
  for (const [category, templates] of categories) {
    console.log(`\n${category.toUpperCase()}`);
    for (const template of templates) {
      const templateConfig = config.templates.available[template];
      console.log(`  📁 ${template}`);
      console.log(`     ${templateConfig.description}`);
      console.log(`     Features: ${templateConfig.features.join(', ')}`);
    }
  }
}

export async function listFeatures() {
  const config = await loadScalpelConfig();
  
  console.log('\nAvailable features:');
  console.log('-------------------');
  
  for (const [name, feature] of Object.entries(config.features)) {
    console.log(`  ⚡ ${name}`);
    console.log(`     ${feature.description}`);
    
    if (feature.required_extensions?.length) {
      console.log(`     Required VS Code extensions:`);
      feature.required_extensions.forEach(ext => {
        console.log(`       - ${ext}`);
      });
    }
  }
}
