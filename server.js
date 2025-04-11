// === Minimal Claim Search & Display ===
// Backend: Node.js + Express
// Frontend: HTML + TailwindCSS (optional)

const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSYjPh5a9Kxd3PMtmRYlgGati7lHn7di8q7J2XqTfrS_UJdQaIUpOfAjn-9u1mF0ECRytxmUYlKAAzc/pub?gid=0&single=true&output=csv";

app.use(express.json());
app.use(express.static("public"));

async function getClaimRow(claimNo) {
  const response = await axios.get(CSV_URL);
  const rows = response.data.split("\n").map(row => row.split(","));

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1]?.trim() === claimNo.trim()) {
      return {
        tpa_name: rows[i][0],
        claim_no: rows[i][1],
        insurance: rows[i][2],
        claim_type: rows[i][3],
        patient_name: rows[i][11],
        doa: rows[i][16],
        dod: rows[i][27],
        insured_name: rows[i][28],
        hospital_name: rows[i][18],
        hospital_address: rows[i][26],
        city: rows[i][21],
        state: rows[i][20]
      };
    }
  }
  return null;
}

app.post("/search", async (req, res) => {
  const { claimNo } = req.body;

  try {
    const result = await getClaimRow(claimNo);
    if (!result) return res.status(404).json({ error: "Not found" });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
