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
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTw1R0AYFOUYzqpE5b51VmS9HHpH4Osv42RqbmauyYGOlZJiCoMgWOAN5JKgDBDfPFITQtZk3LZYDuK/pub?output=csv"; // Replace this with your public CSV link

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
  claim_no: row["ClmID"],
  patient_name: row["Patient Name"],
  Policyno: row["PolicyNo"],
  doa: row["Date of Admission"],
  dod: row["Clmdod"],
  insured_name: row["PriBeneficiaryName"],
  hospital_name: row["HospName"],
  city: row["CityName"],
  state: row["HOSPITAL STATE"]
});


    doc.render();

    const buffer = doc.getZip().generate({ type: "nodebuffer" });
    const outputName = `Claim_${claimNumber}.docx`;
    const outputPath = path.join(__dirname, outputName);

    fs.writeFileSync(outputPath, buffer);

    res.download(outputPath, outputName, () => {
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    console.error("Error generating document:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server is running and listening on port ${PORT}`);
});

async function getClaimData(claimNumber) {
  const response = await axios.get(CSV_URL);
  const rows = response.data.split("\n").map(row => row.split(","));
  const headers = rows[0].map(h => h.trim().replace(/\r/g, ""));

  console.log("Looking for Claim ID:", claimNumber);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const data = Object.fromEntries(headers.map((h, j) => [h, (row[j] || "").trim()]));

    console.log(`Row ${i} ClmID:`, data["ClmID"]); // Debug log

    if (data["ClmID"] === claimNumber.trim()) {
      console.log("✅ Claim match found!");
      return data;
    }
  }

  console.log("❌ No claim matched.");
  return null;
}

