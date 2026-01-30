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
    }
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
    }
  },

  "Electrical Complaint": {
    keywords: ["battery", "starter", "self", "wiring", "light", "meter", "rpm", "error"],
    subs: {
      "Battery problem": ["battery"],
      "Self/Starter motor problem": ["starter", "self"],
      "Wiring problem": ["wiring"],
      "Error Code in Machine display": ["error code"],
      "Light not working": ["light"],
      "speed/rpm meter not working": ["rpm", "speed"],
    }
  },

  Engine: {
    keywords: ["engine", "motor", "smoke", "dhua", "heat", "garam", "oil", "radiator"],
    subs: {
      "Engine Over heating": ["overheat", "garam"],
      "Smoke problem": ["smoke", "dhua"],
      "Oil consumption high": ["oil jyada"],
      "Radiator leak": ["radiator", "coolant"],
      "Abnormal Noise": ["noise", "awaz"],
      "Missing problem": ["missing"],
    }
  },

  Hydraulic: {
    keywords: ["hydraulic", "pressure", "pump", "joystick", "slow"],
    subs: {
      "Pressure down": ["pressure down", "pressure kam"],
      "Hydraulic pump leak": ["pump leak"],
      "Hydraulic pump Noise": ["pump noise"],
      "Joy Stick Leakage": ["joystick"],
      "Machine performance low/Slow working": ["slow"],
    }
  },

  "Transmission/Axle components": {
    keywords: ["gear", "gearbox", "brake", "axle", "reverse"],
    subs: {
      "Gear box problem": ["gearbox"],
      "Brake problem": ["brake"],
      "Reverse forward issue": ["reverse"],
      "Transmission overheat": ["transmission heat"],
    }
  },

  Hose: {
    keywords: ["hose", "pipe"],
    subs: {
      "Hose cut": ["hose cut"],
      "Hose leakages": ["hose leak"],
      "Hose O ring Cut": ["o ring"],
    }
  },

  "Ram/Cylinder": {
    keywords: ["ram", "cylinder", "rod"],
    subs: {
      "Ram leak": ["ram leak"],
      "Rod bend": ["rod bend"],
      "Rod broken": ["rod broken"],
      "Seal leak": ["seal leak"],
    }
  },

  "Tyre/Battery": {
    keywords: ["tyre", "tire", "puncture", "burst", "battery"],
    subs: {
      "Tyre cut": ["tyre cut"],
      "Tyre burst": ["burst"],
      "Tube puncture": ["puncture"],
      "Battery problem": ["battery"],
    }
  },

  "Under Carriage": {
    keywords: ["track", "idler", "roller", "sprocket"],
    subs: {
      "Track Motor leak": ["track motor"],
      "Roller leakage": ["roller leak"],
      "Idler wheel noise": ["idler noise"],
    }
  },

  Service: {
    keywords: ["service", "visit"],
    subs: {
      "Service Visit": ["service"],
      "Actual Service": ["actual service"],
    }
  },

  Installation: {
    keywords: ["installation"],
    subs: {
      "Installation visit": ["installation"],
    }
  },

  "General Visit": {
    keywords: ["visit", "inspection"],
    subs: {
      "General Visit": ["general visit"],
      "Accidental": ["accident"],
    }
  },

  Livelink: {
    keywords: ["livelink"],
    subs: {
      "Livelink not working": ["not working"],
      "Alert": ["alert"],
    }
  },

  "AC System": {
    keywords: ["ac", "cooling", "blower"],
    subs: {
      "AC not Working": ["not working"],
      "AC not Cooling": ["not cooling"],
    }
  }
};



export default complaintMap;