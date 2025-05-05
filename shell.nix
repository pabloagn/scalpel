{ pkgs ? import <nixpkgs> {} }:
let
  pythonEnv = pkgs.python312.withPackages (ps: with ps; [
    pip
    setuptools
    wheel
  ]);
in
pkgs.mkShell {
  buildInputs = with pkgs; [
    pythonEnv
    poetry
    ruff
    python312Packages.pylint
    python312Packages.isort
    pkg-config
    git
    gnumake
    gcc
    stdenv.cc.cc.lib
    zlib
    libffi
    nodejs_20
    nodePackages.pnpm
    nodePackages.typescript
    nodePackages.typescript-language-server
    vips
    libjpeg
    libpng
    libwebp
    cairo
    pango
    librsvg
    
    # OpenGL dependencies
    libGL
    libGLU
    xorg.libX11
    xorg.libXi
    xorg.libXmu
    xorg.libXext
    
    # Add GLib and GTK dependencies
    glib
    gtk3
    gdk-pixbuf
  ];
  LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath (with pkgs; [
     stdenv.cc.cc
     zlib
     libffi
     vips
     # OpenGL libraries
     libGL
     libGLU
     xorg.libX11
     xorg.libXi
     xorg.libXmu
     xorg.libXext
     
     # Add GLib and GTK libraries
     glib
     gtk3
     gdk-pixbuf
  ]);
  shellHook = ''
    export POETRY_VIRTUALENVS_IN_PROJECT=true
    echo "Phantom Visuals Nix Env Ready!"
    echo "- Python: $(python --version) (from $(which python))"
    echo "- Poetry: $(poetry --version)"
    echo "- Node  : $(node -v)"
  '';
}
