const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// === Public CSV Setup ===
const CSV_URL = "<YOUR_PUBLISHED_CSV_LINK_HERE>"; // replace this!

async function getClaimData(claimNumber) {
  const response = await axios.get(CSV_URL);
  const rows = response.data.split("\n").map(row => row.split(","));
  const headers = rows[0];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const data = Object.fromEntries(headers.map((h, j) => [h.trim(), row[j]?.trim()]));
    if (data["Claim Number"] === claimNumber) {
      return data;
    }
  }
  return null;
}

app.post("/generate", async (req, res) => {
  const { claimNumber, templateType } = req.body;

  try {
    const row = await getClaimData(claimNumber);

    if (!row) {
      return res.status(404).json({ error: "Claim not found" });
    }

    const templatePath = path.join(__dirname, "templates", `${templateType}.docx`);
    const content = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    doc.setData({
      claim_no: row["Claim Number"],
      patient_name: row["Patient Name"],
      Policyno: row["Policy No"],
      doa: row["DOA"],
      dod: row["DOD"],
      insured_name: row["Insured Name"],
      hospital_name: row["Hospital Name"],
      city: row["City"],
      state:
