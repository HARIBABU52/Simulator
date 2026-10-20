// convert_csv_to_json.js
// This script reads NIFTY_2024to26oct19data.csv and writes it as JSON array to NIFTY_2024to26oct19data.json
// Run with: node convert_csv_to_json.js
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const csvFile = path.join('c:/Users/user/OneDrive/Documents/code/Simulator', 'NIFTY_2024to26oct19data.csv');
const jsonFile = path.join('c:/Users/user/OneDrive/Documents/code/Simulator', 'NIFTY_2024to26oct19data.json');

async function convert() {
  const rl = readline.createInterface({
    input: fs.createReadStream(csvFile),
    crlfDelay: Infinity,
  });

  let headers = [];
  const results = [];
  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) {
      headers = line.split(',');
      continue;
    }
    const values = line.split(',');
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = values[i];
    }
    results.push(obj);
  }
  // Write JSON with pretty formatting
  fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Converted ${lineNum - 1} rows to JSON at ${jsonFile}`);
}

convert().catch(err => console.error('Error during conversion:', err));
