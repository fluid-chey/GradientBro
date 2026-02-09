#!/usr/bin/env node
/**
 * GradientBro CLI
 *
 * Commands:
 *   gradient-bro analyze <image>   — Analyse an image and output a gradient spec
 *   gradient-bro generate <image>  — Analyse + generate CSS in one step
 *   gradient-bro setup-cursor      — Install Cursor skill & rule to ~/.cursor/
 */

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { analyzeImage } from "./analyzer/index";
import { generateCSS } from "./generator/index";
import { FidelityLevel } from "./types";

const program = new Command();

program
  .name("gradient-bro")
  .description(
    "Analyse reference images and generate complex CSS gradients with noise, blur, and blend modes."
  )
  .version("1.0.0");

// ── analyze ──────────────────────────────────────────────────────────

program
  .command("analyze <image>")
  .description("Analyse an image and output its gradient specification as JSON.")
  .option(
    "-f, --fidelity <level>",
    'Fidelity level: "exact", "vibe", or "inspired"',
    "vibe"
  )
  .option("-o, --output <file>", "Write JSON to a file instead of stdout")
  .option(
    "--clusters <n>",
    "Override the number of colour clusters",
    undefined
  )
  .option(
    "--size <n>",
    "Analysis resolution (pixels, default 100)",
    "100"
  )
  .action(async (image: string, opts) => {
    const fidelity = opts.fidelity as FidelityLevel;
    const resolvedImage = path.resolve(image);

    if (!fs.existsSync(resolvedImage)) {
      console.error(`Error: File not found: ${resolvedImage}`);
      process.exit(1);
    }

    try {
      const spec = await analyzeImage(resolvedImage, fidelity, {
        colorClusters: opts.clusters ? parseInt(opts.clusters) : undefined,
        analysisSize: parseInt(opts.size),
      });

      const json = JSON.stringify(spec, null, 2);

      if (opts.output) {
        fs.writeFileSync(path.resolve(opts.output), json, "utf-8");
        console.log(`Gradient spec written to ${opts.output}`);
      } else {
        console.log(json);
      }
    } catch (err: any) {
      console.error(`Analysis failed: ${err.message}`);
      process.exit(1);
    }
  });

// ── generate ─────────────────────────────────────────────────────────

program
  .command("generate <image>")
  .description("Analyse an image and generate CSS in one step.")
  .option(
    "-f, --fidelity <level>",
    'Fidelity level: "exact", "vibe", or "inspired"',
    "vibe"
  )
  .option(
    "-s, --selector <sel>",
    "CSS selector / class name for the container",
    ".gradient-container"
  )
  .option("-r, --border-radius <val>", "Border radius, e.g. '16px'", "0")
  .option("-o, --output <file>", "Write CSS to a file instead of stdout")
  .option("--size <n>", "Analysis resolution (pixels, default 100)", "100")
  .action(async (image: string, opts) => {
    const fidelity = opts.fidelity as FidelityLevel;
    const resolvedImage = path.resolve(image);

    if (!fs.existsSync(resolvedImage)) {
      console.error(`Error: File not found: ${resolvedImage}`);
      process.exit(1);
    }

    try {
      const spec = await analyzeImage(resolvedImage, fidelity, {
        analysisSize: parseInt(opts.size),
      });

      const css = generateCSS(spec, {
        selector: opts.selector,
        fidelity,
        borderRadius: opts.borderRadius !== "0" ? opts.borderRadius : undefined,
      });

      if (opts.output) {
        fs.writeFileSync(path.resolve(opts.output), css, "utf-8");
        console.log(`CSS written to ${opts.output}`);
      } else {
        console.log(css);
      }
    } catch (err: any) {
      console.error(`Generation failed: ${err.message}`);
      process.exit(1);
    }
  });

// ── setup-cursor ─────────────────────────────────────────────────────

program
  .command("setup-cursor")
  .description(
    "Install the GradientBro Cursor skill and rule to ~/.cursor/ so you can use it from any project."
  )
  .action(() => {
    const home = process.env.HOME || process.env.USERPROFILE || "~";
    const skillSrc = path.resolve(__dirname, "..", "cursor-skill");
    const skillDest = path.join(home, ".cursor", "skills", "gradient-bro");
    const ruleDest = path.join(home, ".cursor", "rules", "gradient-bro.mdc");

    // Copy skill directory
    if (!fs.existsSync(skillSrc)) {
      console.error(
        "Error: cursor-skill directory not found in the package. Re-install gradient-bro."
      );
      process.exit(1);
    }

    fs.mkdirSync(skillDest, { recursive: true });
    copyDirSync(skillSrc, skillDest);
    console.log(`Cursor skill installed to ${skillDest}`);

    // Copy rule file
    const ruleSrc = path.resolve(__dirname, "..", "cursor-rule", "gradient-bro.mdc");
    if (fs.existsSync(ruleSrc)) {
      fs.mkdirSync(path.dirname(ruleDest), { recursive: true });
      fs.copyFileSync(ruleSrc, ruleDest);
      console.log(`Cursor rule installed to ${ruleDest}`);
    } else {
      console.log(
        "Note: cursor-rule/gradient-bro.mdc not found in package; rule not installed."
      );
    }

    console.log("\nDone! Restart Cursor to pick up the new skill.");
  });

/** Recursively copy a directory. */
function copyDirSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

program.parse();
