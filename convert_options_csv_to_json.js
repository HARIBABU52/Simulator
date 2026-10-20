// convert_options_csv_to_json.js
// Converts options CSV files from optionsData into JSON format,
// structured under <expiry>Expire/ce and <expiry>Expire/pe folders.

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Locations to check and output
const workspaceRoot = 'c:/Users/user/OneDrive/Documents/code/Simulator';
const niftyChartsOptionsDir = path.join(workspaceRoot, 'nifty-charts', 'optionsData');
const rootOptionsDir = path.join(workspaceRoot, 'optionsData');

async function convertCsvFile(csvFilePath) {
  const fileStream = fs.createReadStream(csvFilePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let headers = [];
  const results = [];
  let lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (lineNum === 1) {
      headers = trimmedLine.split(',').map(h => h.trim());
      continue;
    }

    const values = trimmedLine.split(',').map(v => v.trim());
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = values[i] !== undefined ? values[i] : '';
    }
    results.push(obj);
  }

  return results;
}

async function run() {
  const sourceDir = fs.existsSync(niftyChartsOptionsDir) ? niftyChartsOptionsDir : rootOptionsDir;
  console.log(`Reading CSV files from: ${sourceDir}`);

  const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.csv'));
  if (files.length === 0) {
    console.log('No CSV files found.');
    return;
  }

  // Target directory: only in nifty-charts/optionsData
  const targetDirs = [
    path.join(niftyChartsOptionsDir, '27octExpire'),
  ];

  for (const baseDir of targetDirs) {
    fs.mkdirSync(path.join(baseDir, 'ce'), { recursive: true });
    fs.mkdirSync(path.join(baseDir, 'pe'), { recursive: true });
  }

  for (const file of files) {
    const isCall = /CALL|CE/i.test(file);
    const isPut = /PUT|PE/i.test(file);
    const subfolder = isCall ? 'ce' : (isPut ? 'pe' : 'other');

    const csvPath = path.join(sourceDir, file);
    console.log(`Converting ${file} -> [${subfolder}]...`);
    const data = await convertCsvFile(csvPath);

    const jsonFileName = file.replace(/\.csv$/i, '.json');
    const jsonContent = JSON.stringify(data, null, 2);

    for (const baseDir of targetDirs) {
      const outDir = path.join(baseDir, subfolder);
      const outPath = path.join(outDir, jsonFileName);
      fs.writeFileSync(outPath, jsonContent, 'utf8');
      console.log(`Saved: ${outPath} (${data.length} rows)`);
    }
  }

  console.log('All option CSV files converted successfully.');
}

run().catch(err => {
  console.error('Error during conversion:', err);
  process.exit(1);
});
