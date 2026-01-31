const complaintMap = {
  "Body Work": {
    keywords: ["body", "drum", "vibration", "bushing", "sticker", "paint"],
    subs: {
      "Leakage from Drum": ["drum leak"],
      "Noise from Drum": ["drum noise", "awaz"],
      "Vibration fault in Drum": ["vibration"],
      "Water Sprinkle Pipe fault": ["sprinkle pipe"],
      "Bushing Work": ["bushing"],
      "color fad problem": ["color fade"],
      "Decal/Sticker Pesting": ["sticker"],
    },
  },

  Cabin: {
    keywords: ["cabin", "door", "glass", "seat", "roof", "bonnet", "fan"],
    subs: {
      "Cab Door Fault": ["door problem"],
      "Cabin glass cracked": ["glass cracked"],
      "Fan not working": ["fan not working"],
      "Operator Seat problems": ["seat"],
      "Roof cracked": ["roof"],
      "bonnet crack": ["bonnet"],
    },
  },

  "Electrical Complaint": {
    keywords: [
      "battery",
      "starter",
      "self",
      "wiring",
      "light",
      "meter",
      "rpm",
      "error",
      "electrical",
    ],
    subs: {
      "Battery problem": ["battery"],
      "Self/Starter motor problem": ["starter", "self"],
      "Wiring problem": ["wiring"],
      "Error Code in Machine display": ["error code"],
      "Light not working": ["light"],
      "speed/rpm meter not working": ["rpm", "speed"],
    },
  },

  Engine: {
    keywords: [
      "engine",
      "motor",
      "smoke",
      "dhua",
      "heat",
      "garam",
      "oil",
      "radiator",
      "oil leak",
      "engine oil",
      "oil leaking",
      "leak",
    ],
    subs: {
      "Engine Over heating": ["overheat", "garam"],
      "Smoke problem": ["smoke", "dhua"],
      "Oil consumption high": ["oil jyada"],
      "Radiator leak": ["radiator", "coolant"],
      "Abnormal Noise": ["noise", "awaz"],
      "Missing problem": ["missing"],
    },
  },

  Hydraulic: {
    keywords: ["hydraulic", "pressure", "pump", "joystick", "slow"],
    subs: {
      "Pressure down": ["pressure down", "pressure kam"],
      "Hydraulic pump leak": ["pump leak"],
      "Hydraulic pump Noise": ["pump noise"],
      "Joy Stick Leakage": ["joystick"],
      "Machine performance low/Slow working": ["slow"],
    },
  },

  "Transmission/Axle components": {
    keywords: ["gear", "gearbox", "brake", "axle", "reverse"],
    subs: {
      "Gear box problem": ["gearbox"],
      "Brake problem": ["brake"],
      "Reverse forward issue": ["reverse"],
      "Transmission overheat": ["transmission heat"],
    },
  },

  Hose: {
    keywords: ["hose", "pipe"],
    subs: {
      "Hose cut": ["hose cut"],
      "Hose leakages": ["hose leak"],
      "Hose O ring Cut": ["o ring"],
    },
  },

  "Fabrication part": {
    keywords: [
      "fabrication",
      "welding",
      "frame",
      "crack",
      "broken",
      "structure",
    ],
    subs: {
      "Welding work": ["welding"],
      "Structure crack": ["crack", "broken"],
    },
  },

  PDI: {
    keywords: ["pdi", "pre delivery", "delivery check"],
    subs: {
      "PDI Issue": ["pdi"],
    },
  },

  "ECU problem": {
    keywords: ["ecu", "controller", "module", "sensor", "fault code"],
    subs: {
      "ECU Error": ["ecu", "controller"],
      "Sensor fault": ["sensor"],
    },
  },

  Campaign: {
    keywords: ["campaign", "recall", "update"],
    subs: {
      "Campaign Activity": ["campaign", "recall"],
    },
  },

  "Ram/Cylinder": {
    keywords: ["ram", "cylinder", "rod"],
    subs: {
      "Ram leak": ["ram leak"],
      "Rod bend": ["rod bend"],
      "Rod broken": ["rod broken"],
      "Seal leak": ["seal leak"],
    },
  },

  "Tyre/Battery": {
    keywords: ["tyre", "tire", "puncture", "burst", "कट", "टायर"],
    subs: {
      "Tyre cut": ["tyre cut"],
      "Tyre burst": ["burst"],
      "Tube puncture": ["puncture"],
      "Battery problem": ["battery"],
    },
  },

  "Under Carriage": {
    keywords: ["track", "idler", "roller", "sprocket"],
    subs: {
      "Track Motor leak": ["track motor"],
      "Roller leakage": ["roller leak"],
      "Idler wheel noise": ["idler noise"],
    },
  },

  Service: {
    keywords: ["service", "visit"],
    subs: {
      "Service Visit": ["service"],
      "Actual Service": ["actual service"],
    },
  },

  Installation: {
    keywords: ["installation"],
    subs: {
      "Installation visit": ["installation"],
    },
  },

  "General Visit": {
    keywords: ["visit", "inspection"],
    subs: {
      "General Visit": ["general visit"],
      Accidental: ["accident"],
    },
  },

  Livelink: {
    keywords: ["livelink"],
    subs: {
      "Livelink not working": ["not working"],
      Alert: ["alert"],
    },
  },

  "AC System": {
    // ⚠️  removed "ek", "not working", "band" — they are too generic and
    //      match almost any Hindi sentence, causing false-positive AC detection.
    //      "ac" and "cooling"/"thanda" are specific enough on their own.
    keywords: ["ac", "a c", "air condition", "cooling", "thanda"],
    subs: {
      "AC not Working": ["not working", "band", "kaam nahi"],
      "AC not Cooling": ["not cooling", "cooling nahi"],
    },
  },
};

export default complaintMap;