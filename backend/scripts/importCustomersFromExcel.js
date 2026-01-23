import mongoose from "mongoose";
import XLSX from "xlsx";
import dotenv from "dotenv";
import Customer from "../models/Customer.js";

dotenv.config();

/* ---------- CONNECT DB ---------- */
await mongoose.connect(process.env.MONGO_URI);

/* ---------- LOAD EXCEL ---------- */
const workbook = XLSX.readFile("./data/customers.xlsx"); // path to file
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

/* ---------- MAP & INSERT ---------- */
for (const row of rows) {
  if (!row.machine_no) continue;

  await Customer.updateOne(
    { chassisNo: String(row.machine_no).trim() },
    {
      chassisNo: String(row.machine_no).trim(),
      name: row.customer_name,
      phone: row.customer_phone_no || row.phone1 || row.phone2,
      city: row.city,
      machineModel: row.machine_model,
      purchaseDate: row.purchase_date
        ? new Date(row.purchase_date)
        : null,
      warrantyStatus: row.is_active ? "active" : "expired",
      notes: `
        Type: ${row.machine_type}
        Dealer: ${row.branch_name}
        Outlet: ${row.outlet}
        RM: ${row.machine_rm_number}
        `,
    },
    { upsert: true }
  );
}

console.log("✅ Excel data imported successfully");
process.exit();
