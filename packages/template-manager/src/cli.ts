// packages/template-manager/src/cli.ts

import { Command } from 'commander';
import { spawn, listTemplates, listFeatures } from './index.js';
import path from 'path';
import fs from 'fs/promises';

const program = new Command();

program
  .name('template-manager')
  .description('Scalpel template management system')
  .version('1.0.0');

// Create template command
program
  .command('create <template> <name>')
  .description('Create a new project from a template')
  .option('-f, --features <features...>', 'Additional features to include')
  .option('-r, --repo <repo>', 'Repository to use for templates')
  .action(async (template, name, options) => {
    try {
      // Load config to get repo information
      const configPath = path.join(process.cwd(), 'scalpel.config.json');
      const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      
      const templateConfig = config.templates.available[template];
      if (!templateConfig) {
        console.error(`❌ Template "${template}" not found`);
        await listTemplates();
        process.exit(1);
      }
      
      const repoKey = options.repo || templateConfig.repository || 'default';
      const repo = config.templates.repositories[repoKey];
      
      if (!repo) {
        console.error(`❌ Repository "${repoKey}" not found`);
        process.exit(1);
      }
      
      // Merge features
      const features = [
        ...(templateConfig.features || []),
        ...(options.features || [])
      ];
      
      // Remove duplicates
      const uniqueFeatures = [...new Set(features)];
      
      await spawn({
        template,
        name,
        features: uniqueFeatures,
        repo,
        path: templateConfig.path
      });
      
    } catch (error) {
      console.error('❌ Error creating project:', error);
      process.exit(1);
    }
  });

// List templates command
program
  .command('list')
  .description('List all available templates')
  .action(async () => {
    await listTemplates();
  });

// List features command
program
  .command('features')
  .description('List all available features')
  .action(async () => {
    await listFeatures();
  });

// Show template details command
program
  .command('info <template>')
  .description('Show detailed information about a template')
  .action(async (template) => {
    try {
      const configPath = path.join(process.cwd(), 'scalpel.config.json');
      const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      
      const templateConfig = config.templates.available[template];
      if (!templateConfig) {
        console.error(`❌ Template "${template}" not found`);
        process.exit(1);
      }
      
      console.log(`\nTemplate: ${template}`);
      console.log(`Category: ${templateConfig.category}`);
      console.log(`Description: ${templateConfig.description}`);
      console.log(`Repository: ${templateConfig.repository || 'default'}`);
      console.log(`Path: ${templateConfig.path}`);
      console.log(`Features:`);
      
      for (const feature of templateConfig.features) {
        const featureConfig = config.features[feature];
        if (featureConfig) {
          console.log(`  ⚡ ${feature}: ${featureConfig.description}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

// Feature info command
program
  .command('feature-info <feature>')
  .description('Show detailed information about a feature')
  .action(async (feature) => {
    try {
      const configPath = path.join(process.cwd(), 'scalpel.config.json');
      const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      
      const featureConfig = config.features[feature];
      if (!featureConfig) {
        console.error(`❌ Feature "${feature}" not found`);
        process.exit(1);
      }
      
      console.log(`\nFeature: ${feature}`);
      console.log(`Description: ${featureConfig.description}`);
      
      if (featureConfig.required_extensions?.length) {
        console.log(`\nRequired VS Code extensions:`);
        featureConfig.required_extensions.forEach((ext: string) => {
          console.log(`  - ${ext}`);
        });
      }
      
      if (featureConfig.files) {
        console.log(`\nFiles created:`);
        Object.keys(featureConfig.files).forEach((file: string) => {
          console.log(`  - ${file}`);
        });
      }
      
      if (featureConfig.vscode_settings) {
        console.log(`\nVS Code settings modified:`);
        Object.keys(featureConfig.vscode_settings).forEach((setting: string) => {
          console.log(`  - ${setting}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

// Interactive template creation
program
  .command('init')
  .description('Interactively create a new project')
  .action(async () => {
    const inquirer = await import('inquirer');
    
    try {
      const configPath = path.join(process.cwd(), 'scalpel.config.json');
      const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      
      // Step 1: Choose template
      const templateChoices = Object.entries(config.templates.available).map(
        ([key, template]: [string, any]) => ({
          name: `${key} - ${template.description}`,
          value: key,
          short: key
        })
      );
      
      const { template } = await inquirer.default.prompt([
        {
          type: 'list',
          name: 'template',
          message: 'Choose a template:',
          choices: templateChoices,
          pageSize: 10
        }
      ]);
      
      // Step 2: Enter project name
      const { name } = await inquirer.default.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Project name:',
          validate: (input: string) => {
            if (!input) return 'Project name is required';
            if (!/^[a-zA-Z0-9-_]+$/.test(input)) {
              return 'Project name can only contain letters, numbers, hyphens, and underscores';
            }
            return true;
          }
        }
      ]);
      
      // Step 3: Choose additional features
      const templateConfig = config.templates.available[template];
      const availableFeatures = Object.keys(config.features)
        .filter((f: string) => !templateConfig.features.includes(f));
      
      const featureChoices = availableFeatures.map((feature: string) => ({
        name: `${feature} - ${config.features[feature].description}`,
        value: feature,
        checked: false
      }));
      
      const { features } = await inquirer.default.prompt([
        {
          type: 'checkbox',
          name: 'features',
          message: 'Select additional features:',
          choices: featureChoices,
          pageSize: 10
        }
      ]);
      
      // Step 4: Confirm
      console.log('\nProject configuration:');
      console.log(`  Template: ${template}`);
      console.log(`  Name: ${name}`);
      console.log(`  Features: ${[...templateConfig.features, ...features].join(', ')}`);
      
      const { confirm } = await inquirer.default.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Create project with this configuration?',
          default: true
        }
      ]);
      
      if (!confirm) {
        console.log('Project creation cancelled');
        return;
      }
      
      // Step 5: Create project
      const repoKey = templateConfig.repository || 'default';
      const repo = config.templates.repositories[repoKey];
      
      await spawn({
        template,
        name,
        features: [...templateConfig.features, ...features],
        repo,
        path: templateConfig.path
      });
      
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

program.parse();
