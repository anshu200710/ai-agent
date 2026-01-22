import express from "express";
import Customer from "../models/Customer.js";

const router = express.Router();

/* =======================
   ADD NEW CUSTOMER
======================= */
router.post("/", async (req, res) => {
  try {
    const {
      chassisNo,
      name,
      phone,
      city,
      machineModel,
      purchaseDate,
      warrantyStatus,
      notes,
    } = req.body;

    if (!chassisNo || !name || !phone || !city) {
      return res.status(400).json({
        message: "chassisNo, name, phone, city are required",
      });
    }

    const exists = await Customer.findOne({ chassisNo });
    if (exists) {
      return res.status(409).json({
        message: "Customer with this chassis number already exists",
      });
    }

    const customer = await Customer.create({
      chassisNo,
      name,
      phone,
      city,
      machineModel,
      purchaseDate,
      warrantyStatus,
      notes,
    });

    res.status(201).json({
      message: "Customer added successfully",
      customer,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =======================
   UPDATE CUSTOMER
======================= */
router.put("/:id", async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json({
      message: "Customer updated successfully",
      customer,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =======================
   GET CUSTOMER BY CHASSIS
======================= */
router.get("/chassis/:chassisNo", async (req, res) => {
  try {
    const customer = await Customer.findOne({
      chassisNo: req.params.chassisNo,
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =======================
   GET CUSTOMER BY PHONE
======================= */
router.get("/phone/:phone", async (req, res) => {
  try {
    const customer = await Customer.findOne({ phone: req.params.phone });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =======================
   LIST ALL CUSTOMERS
======================= */
router.get("/", async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
