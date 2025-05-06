// scripts/create.ts

import path from 'path';
import fs from 'fs/promises';
import { spawn } from '../packages/template-manager/src/index.js';

export async function createProject(template: string, name: string, options: any) {
  try {
    // Load config
    const configPath = path.join(process.cwd(), 'scalpel.config.json');
    const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    
    const templateConfig = config.templates.available[template];
    if (!templateConfig) {
      console.error(`❌ Template "${template}" not found`);
      console.log('\nAvailable templates:');
      await listTemplates();
      process.exit(1);
    }
    
    // Merge features
    const features = [
      ...(templateConfig.features || []),
      ...(options.features || [])
    ];
    
    await spawn({
      template,
      name,
      features,
      repo: config.templates.repositories.default,
      path: templateConfig.path
    });
    
  } catch (error) {
    console.error('❌ Error creating project:', error);
    process.exit(1);
  }
}

async function listTemplates() {
  const configPath = path.join(process.cwd(), 'scalpel.config.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
  
  console.log('\nAvailable templates:');
  for (const [name, template] of Object.entries(config.templates.available)) {
    console.log(`  📁 ${name} (${template.category})`);
    console.log(`     Features: ${template.features.join(', ')}`);
  }
}
