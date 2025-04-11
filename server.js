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

const CSV_URL ="https://docs.google.com/spreadsheets/d/e/2PACX-1vSYjPh5a9Kxd3PMtmRYlgGati7lHn7di8q7J2XqTfrS_UJdQaIUpOfAjn-9u1mF0ECRytxmUYlKAAzc/pub?gid=0&single=true&output=csv";

async function getClaimData(claimNumber) {
  const response = await axios.get(CSV_URL);
  const rows = response.data.split("\n").map(row => row.split(","));

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i].map(col => col.trim());
    if (row[1] === claimNumber.trim()) {
      return {
        tpa_name: row[0],
        claim_no: row[1],
        insurance: row[2],
        claim_type: row[3],
        patient_name: row[12],
        doa: row[16],
        hospital_name: row[18],
        state: row[19],
        city: row[20],
        Policyno: row[23],
        dod: row[27],
        insured_name: row[28],
        hospital_address: row[26]
      };
    }
  }
  return null;
}

app.post("/check", async (req, res) => {
  const { claimNumber } = req.body;
  try {
    const data = await getClaimData(claimNumber);
    if (!data) {
      return res.status(404).json({ error: "Claim not found" });
    }
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/generate", async (req, res) => {
  const { claimNumber, templateType } = req.body;
  try {
    const data = await getClaimData(claimNumber);
    if (!data) return res.status(404).json({ error: "Claim not found" });

    const templatePath = path.join(__dirname, "templates", `${templateType}_Template.docx`);
    const content = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    doc.setData(data);
    doc.render();

    const buffer = doc.getZip().generate({ type: "nodebuffer" });
    const outputName = `Claim_${claimNumber}.docx`;
    const outputPath = path.join(__dirname, outputName);

    fs.writeFileSync(outputPath, buffer);
    res.download(outputPath, outputName, () => fs.unlinkSync(outputPath));
  } catch (err) {
    console.error("Docx generation error:", err);
    return res.status(500).json({ error: "Document generation failed" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
