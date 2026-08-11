// TEMPORARY MOCK DATA — replace with FastAPI backend
import type { Brand, Category, FaqItem, Product, Review, StockStatus } from "./types";

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export const brands: Brand[] = [
  { slug: "allen-bradley", name: "Allen Bradley", logo: "/images/brands/allen-bradley.svg" },
  { slug: "siemens", name: "Siemens", logo: "/images/brands/siemens.svg" },
  { slug: "mitsubishi", name: "Mitsubishi", logo: "/images/brands/mitsubishi.svg" },
  { slug: "omron", name: "Omron", logo: "/images/brands/omron.svg" },
  { slug: "schneider-electric", name: "Schneider Electric", logo: "/images/brands/schneider-electric.svg" },
  { slug: "danfoss", name: "Danfoss", logo: "/images/brands/danfoss.svg" },
];

// ---------------------------------------------------------------------------
// Categories (productCount computed below once products[] exists)
// ---------------------------------------------------------------------------

const categoryDefs: Omit<Category, "productCount">[] = [
  { slug: "plcs-machine-control", name: "PLCs & Machine Control", icon: "/images/categories/plcs-machine-control.svg" },
  { slug: "drives", name: "Drives", icon: "/images/categories/drives.svg" },
  { slug: "hmi-mmi-oit", name: "HMI/MMI/OIT", icon: "/images/categories/hmi-mmi-oit.svg" },
  { slug: "contactors-starters", name: "Contactors & Starters", icon: "/images/categories/contactors-starters.svg" },
  { slug: "pneumatics", name: "Pneumatics", icon: "/images/categories/pneumatics.svg" },
  { slug: "safety-systems", name: "Safety Systems", icon: "/images/categories/safety-systems.svg" },
  { slug: "power-supplies", name: "Power Supplies", icon: "/images/categories/power-supplies.svg" },
  { slug: "sensors-switches", name: "Sensors & Switches", icon: "/images/categories/sensors-switches.svg" },
];

// ---------------------------------------------------------------------------
// Products — 48 total, 6 per category
// ---------------------------------------------------------------------------

type ProductSeed = {
  slug: string;
  partNumber: string;
  name: string;
  brand: string;
  categorySlug: string;
  shortSpecs: [string, string, string];
  description: string[];
  alternatePartNumbers: string[];
  specifications: Record<string, string>;
  price: number;
  stock: StockStatus;
};

const stockCycle: StockStatus[] = ["in-stock", "low-stock", "out-of-stock"];

const productSeeds: ProductSeed[] = [
  // ---------------- PLCs & Machine Control (6) ----------------
  {
    slug: "1756-l61",
    partNumber: "1756-L61",
    name: "ControlLogix 5561 Processor Module",
    brand: "allen-bradley",
    categorySlug: "plcs-machine-control",
    shortSpecs: ["2 MB user memory", "ControlBus backplane", "16 axis motion control"],
    description: [
      "ControlLogix 5561 processor for mid-to-large scale automation systems",
      "Supports up to 16 axes of integrated motion control",
      "Removable compact flash for program and firmware storage",
      "Redundant backplane compatible",
      "Rated for continuous industrial duty cycles",
    ],
    alternatePartNumbers: ["1756L61", "1756-L61/B"],
    specifications: {
      "User Memory": "2 MB",
      "I/O Points": "128,000 max",
      "Backplane": "ControlBus",
      "Mounting": "DIN Rail / Panel",
      "Operating Temp": "0-60°C",
      "Comm Ports": "USB, RS-232",
    },
    price: 3450,
    stock: "in-stock",
  },
  {
    slug: "1769-l33er",
    partNumber: "1769-L33ER",
    name: "CompactLogix 5370 Controller",
    brand: "allen-bradley",
    categorySlug: "plcs-machine-control",
    shortSpecs: ["1 MB memory", "Dual Ethernet ports", "16 local I/O modules"],
    description: [
      "Compact controller for small-to-medium machine applications",
      "Dual embedded EtherNet/IP ports for device-level ring topology",
      "Supports up to 16 local Compact I/O modules",
      "Integrated motion via EtherNet/IP",
    ],
    alternatePartNumbers: ["1769L33ER"],
    specifications: {
      "User Memory": "1 MB",
      "I/O Points": "16 local modules",
      "Comm Ports": "2x EtherNet/IP",
      "Mounting": "DIN Rail",
      "Operating Temp": "0-55°C",
    },
    price: 1890,
    stock: "in-stock",
  },
  {
    slug: "s7-1200-cpu-1214c",
    partNumber: "6ES7214-1AG40-0XB0",
    name: "SIMATIC S7-1200 CPU 1214C",
    brand: "siemens",
    categorySlug: "plcs-machine-control",
    shortSpecs: ["100 KB program memory", "14 DI / 10 DO", "2 analog inputs"],
    description: [
      "Compact CPU for small automation systems with integrated I/O",
      "Built-in PROFINET interface for programming and HMI communication",
      "Supports up to 3 communication modules and 8 signal boards",
      "PID control and high-speed counting on board",
    ],
    alternatePartNumbers: ["S7-1214C", "6ES7 214-1AG40-0XB0"],
    specifications: {
      "Program Memory": "100 KB",
      "Digital I/O": "14 DI / 10 DO",
      "Analog Inputs": "2",
      "Comm Ports": "PROFINET",
      "Mounting": "DIN Rail",
    },
    price: 425,
    stock: "in-stock",
  },
  {
    slug: "fx5u-32mt",
    partNumber: "FX5U-32MT/ES",
    name: "MELSEC iQ-F FX5U Compact PLC",
    brand: "mitsubishi",
    categorySlug: "plcs-machine-control",
    shortSpecs: ["32 I/O points", "Built-in Ethernet", "High-speed processing"],
    description: [
      "Next-generation compact PLC with high-speed processing engine",
      "Built-in Ethernet port supports up to 8 simultaneous connections",
      "Positioning control for up to 4 axes without add-on modules",
      "Wide operating temperature range for harsh environments",
    ],
    alternatePartNumbers: ["FX5U32MT-ES"],
    specifications: {
      "I/O Points": "32 (16 DI / 16 DO)",
      "Program Capacity": "64,000 steps",
      "Comm Ports": "Ethernet, RS-485",
      "Mounting": "DIN Rail / Screw",
      "Operating Temp": "0-55°C",
    },
    price: 610,
    stock: "low-stock",
  },
  {
    slug: "cj2m-cpu34",
    partNumber: "CJ2M-CPU34",
    name: "SYSMAC CJ2M Series CPU Unit",
    brand: "omron",
    categorySlug: "plcs-machine-control",
    shortSpecs: ["20K steps program", "Built-in EtherCAT", "High-speed I/O refresh"],
    description: [
      "Modular PLC CPU offering high-speed instruction execution",
      "Built-in EtherCAT port for high-speed motion networking",
      "Supports up to 640 I/O points with expansion racks",
      "Battery-backed memory retains data on power loss",
    ],
    alternatePartNumbers: ["CJ2MCPU34"],
    specifications: {
      "Program Capacity": "20,000 steps",
      "I/O Points": "640 max",
      "Comm Ports": "EtherCAT, USB",
      "Mounting": "DIN Rail",
    },
    price: 980,
    stock: "in-stock",
  },
  {
    slug: "tm221ce40r",
    partNumber: "TM221CE40R",
    name: "Modicon M221 Logic Controller",
    brand: "schneider-electric",
    categorySlug: "plcs-machine-control",
    shortSpecs: ["40 I/O relay", "Ethernet + Serial", "Compact book format"],
    description: [
      "Compact book-style logic controller for machine automation",
      "24 digital inputs, 16 relay outputs on the base unit",
      "Integrated Ethernet and serial line ports",
      "Cartridge slots for I/O and communication expansion",
    ],
    alternatePartNumbers: ["TM221-CE40R"],
    specifications: {
      "I/O Points": "40 (24 DI / 16 DO Relay)",
      "Comm Ports": "Ethernet, Serial",
      "Mounting": "DIN Rail",
      "Operating Temp": "-10 to 55°C",
    },
    price: 340,
    stock: "out-of-stock",
  },

  // ---------------- Drives (6) ----------------
  {
    slug: "powerflex-525-5hp",
    partNumber: "25B-D010N104",
    name: "PowerFlex 525 AC Drive 5HP",
    brand: "allen-bradley",
    categorySlug: "drives",
    shortSpecs: ["5 HP / 3.7 kW", "Embedded EtherNet/IP", "Integrated safety"],
    description: [
      "Compact AC drive for standalone or embedded machine applications",
      "Built-in EtherNet/IP, USB, and removable HIM display",
      "Integrated Safe Torque Off (STO) without external hardware",
      "Common bus and DC bus sharing capability",
    ],
    alternatePartNumbers: ["PF525-5HP"],
    specifications: {
      "Power Rating": "5 HP / 3.7 kW",
      "Input Voltage": "480V 3-Phase",
      "Output Frequency": "0-590 Hz",
      "Comm": "EtherNet/IP, USB",
      "Enclosure": "IP20 / NEMA 1",
    },
    price: 1150,
    stock: "in-stock",
  },
  {
    slug: "powerflex-753-25hp",
    partNumber: "20F1ANC104AA0NNNNN",
    name: "PowerFlex 753 AC Drive 25HP",
    brand: "allen-bradley",
    categorySlug: "drives",
    shortSpecs: ["25 HP / 18.5 kW", "Modular design", "Advanced motor control"],
    description: [
      "Modular architecture drive for demanding industrial applications",
      "Field-configurable I/O and communication options",
      "Flux vector and sensorless vector control modes",
      "Integrated DriveGuard safety option available",
    ],
    alternatePartNumbers: ["PF753-25HP"],
    specifications: {
      "Power Rating": "25 HP / 18.5 kW",
      "Input Voltage": "480V 3-Phase",
      "Control Method": "Vector / V-Hz",
      "Comm": "EtherNet/IP",
      "Enclosure": "IP20",
    },
    price: 3980,
    stock: "low-stock",
  },
  {
    slug: "sinamics-g120c",
    partNumber: "6SL3210-1KE18-8UP1",
    name: "SINAMICS G120C Compact Drive",
    brand: "siemens",
    categorySlug: "drives",
    shortSpecs: ["7.5 kW", "Integrated PROFINET", "Safety Integrated STO"],
    description: [
      "Compact converter for pump, fan, and conveyor applications",
      "Integrated PROFINET interface for fast commissioning",
      "Built-in Safe Torque Off to SIL2/PLd",
      "Low harmonic distortion built-in filtering",
    ],
    alternatePartNumbers: ["G120C-7K5"],
    specifications: {
      "Power Rating": "7.5 kW",
      "Input Voltage": "380-480V 3-Phase",
      "Comm": "PROFINET",
      "Safety": "STO SIL2",
      "Enclosure": "IP20",
    },
    price: 1420,
    stock: "in-stock",
  },
  {
    slug: "freqrol-fr-e800",
    partNumber: "FR-E820-3.7K-1",
    name: "FREQROL-E800 Compact Inverter",
    brand: "mitsubishi",
    categorySlug: "drives",
    shortSpecs: ["3.7 kW", "Built-in PLC function", "Real sensorless vector"],
    description: [
      "High-performance compact inverter with onboard PLC functionality",
      "Real sensorless vector control for precise torque management",
      "Predictive maintenance diagnostics as standard",
      "Supports CC-Link IE and Ethernet options",
    ],
    alternatePartNumbers: ["FR-E800-3.7K"],
    specifications: {
      "Power Rating": "3.7 kW",
      "Input Voltage": "200-240V 1/3-Phase",
      "Control Method": "Sensorless Vector",
      "Comm": "RS-485, Ethernet (optional)",
    },
    price: 720,
    stock: "in-stock",
  },
  {
    slug: "sysdrive-3g3mx2",
    partNumber: "3G3MX2-AB004-E",
    name: "SYSDRIVE MX2 Series Inverter",
    brand: "omron",
    categorySlug: "drives",
    shortSpecs: ["0.4 kW", "Compact footprint", "Built-in EMC filter"],
    description: [
      "Multi-function compact inverter for general-purpose motor control",
      "Wide range of application-specific parameter presets",
      "Built-in EMC filter meets CE requirements",
      "Removable terminal block for easy replacement",
    ],
    alternatePartNumbers: ["MX2-AB004E"],
    specifications: {
      "Power Rating": "0.4 kW",
      "Input Voltage": "200-240V 1-Phase",
      "Comm": "Modbus RTU",
      "Enclosure": "IP20",
    },
    price: 295,
    stock: "low-stock",
  },
  {
    slug: "altivar-atv320",
    partNumber: "ATV320U15N4B",
    name: "Altivar Machine ATV320 Drive",
    brand: "schneider-electric",
    categorySlug: "drives",
    shortSpecs: ["1.5 kW", "Book format", "Embedded safety function"],
    description: [
      "Compact book-style drive optimized for machine builders",
      "Embedded Power Removal safety function (SIL2/PLd)",
      "Multiple fieldbus options: Modbus, CANopen, EtherNet/IP",
      "Auto-tuning for optimized motor performance",
    ],
    alternatePartNumbers: ["ATV320-U15N4B"],
    specifications: {
      "Power Rating": "1.5 kW",
      "Input Voltage": "380-480V 3-Phase",
      "Safety": "Power Removal SIL2",
      "Comm": "Modbus, CANopen",
    },
    price: 540,
    stock: "in-stock",
  },

  // ---------------- HMI/MMI/OIT (6) ----------------
  {
    slug: "panelview-800-7in",
    partNumber: "2711R-T7T",
    name: "PanelView 800 7-inch Touch Terminal",
    brand: "allen-bradley",
    categorySlug: "hmi-mmi-oit",
    shortSpecs: ["7-inch color touch", "EtherNet/IP", "IP66 front"],
    description: [
      "Compact color touchscreen terminal for machine-level operator interface",
      "Single EtherNet/IP port for PLC and programming connectivity",
      "Sealed front panel rated IP66 for washdown environments",
      "Supports up to 50 screens in application memory",
    ],
    alternatePartNumbers: ["PV800-7"],
    specifications: {
      "Screen Size": "7 in",
      "Resolution": "800x480",
      "Comm": "EtherNet/IP",
      "Enclosure Rating": "IP66 Front",
      "Mounting": "Panel Cutout",
    },
    price: 890,
    stock: "in-stock",
  },
  {
    slug: "panelview-plus-7-1000",
    partNumber: "2711P-T10C22D9P",
    name: "PanelView Plus 7 Performance 10-inch",
    brand: "allen-bradley",
    categorySlug: "hmi-mmi-oit",
    shortSpecs: ["10.4-inch display", "Windows CE runtime", "Dual Ethernet"],
    description: [
      "Performance-series HMI with expanded application capabilities",
      "Runs FactoryTalk View ME for advanced visualization",
      "Dual Ethernet ports for network segregation",
      "Removable data storage for logging and recipes",
    ],
    alternatePartNumbers: ["PVP7-1000"],
    specifications: {
      "Screen Size": "10.4 in",
      "Resolution": "1024x768",
      "Comm": "2x EtherNet/IP, USB",
      "Mounting": "Panel Cutout",
    },
    price: 2340,
    stock: "low-stock",
  },
  {
    slug: "simatic-ktp700-basic",
    partNumber: "6AV2123-2GB03-0AX0",
    name: "SIMATIC KTP700 Basic Panel",
    brand: "siemens",
    categorySlug: "hmi-mmi-oit",
    shortSpecs: ["7-inch TFT", "PROFINET interface", "Key + touch operation"],
    description: [
      "Basic-line HMI panel with combined key and touch operation",
      "Widescreen TFT display with 65,536 colors",
      "Single PROFINET interface for S7 controller connectivity",
      "Configurable via WinCC Basic engineering software",
    ],
    alternatePartNumbers: ["KTP700-Basic"],
    specifications: {
      "Screen Size": "7 in",
      "Resolution": "800x480",
      "Comm": "PROFINET",
      "Mounting": "Panel Cutout",
    },
    price: 610,
    stock: "in-stock",
  },
  {
    slug: "got2000-gt2310",
    partNumber: "GT2310-VTBD",
    name: "GOT2000 GT2310 Operator Terminal",
    brand: "mitsubishi",
    categorySlug: "hmi-mmi-oit",
    shortSpecs: ["5.7-inch STN", "Multi-PLC connectivity", "Built-in RS-422"],
    description: [
      "Compact operator terminal supporting multiple PLC protocols",
      "Built-in RS-422/485 serial port for direct controller link",
      "Optional Ethernet interface unit for network connectivity",
      "Wide operating temperature for panel-mounted machine use",
    ],
    alternatePartNumbers: ["GT2310VTBD"],
    specifications: {
      "Screen Size": "5.7 in",
      "Resolution": "320x240",
      "Comm": "RS-422/485",
      "Mounting": "Panel Cutout",
    },
    price: 480,
    stock: "in-stock",
  },
  {
    slug: "nb7w-tw01b",
    partNumber: "NB7W-TW01B",
    name: "NB-series 7-inch HMI Touchscreen",
    brand: "omron",
    categorySlug: "hmi-mmi-oit",
    shortSpecs: ["7-inch wide TFT", "Ethernet + USB host", "Multi-vendor PLC support"],
    description: [
      "Widescreen HMI with support for multiple PLC vendor protocols",
      "Built-in Ethernet and USB host port for data logging",
      "Free configuration software with macro scripting",
      "Slim bezel design for compact panel cutouts",
    ],
    alternatePartNumbers: ["NB7W-TW01"],
    specifications: {
      "Screen Size": "7 in",
      "Resolution": "800x480",
      "Comm": "Ethernet, USB",
      "Mounting": "Panel Cutout",
    },
    price: 520,
    stock: "low-stock",
  },
  {
    slug: "harmony-gxu-3.5",
    partNumber: "HMIGXU3500",
    name: "Harmony GXU 3.5-inch Terminal",
    brand: "schneider-electric",
    categorySlug: "hmi-mmi-oit",
    shortSpecs: ["3.5-inch QVGA", "Compact size", "Serial + USB"],
    description: [
      "Ultra-compact HMI terminal for small machine footprints",
      "QVGA color display with resistive touchscreen",
      "Serial and USB mini-B ports for programming and comms",
      "Vibration and shock resistant housing",
    ],
    alternatePartNumbers: ["HMI-GXU3500"],
    specifications: {
      "Screen Size": "3.5 in",
      "Resolution": "320x240",
      "Comm": "Serial, USB",
      "Mounting": "Panel Cutout",
    },
    price: 310,
    stock: "out-of-stock",
  },

  // ---------------- Contactors & Starters (6) ----------------
  {
    slug: "100-c09d10",
    partNumber: "100-C09D10",
    name: "IEC Contactor 9A 3-Pole",
    brand: "allen-bradley",
    categorySlug: "contactors-starters",
    shortSpecs: ["9 A rated current", "3-pole + aux contact", "24V DC coil"],
    description: [
      "IEC-rated contactor for motor control up to 4kW at 480V",
      "Convertible auxiliary contact block included",
      "Finger-safe terminal covers for operator protection",
      "DIN rail and panel mounting options",
    ],
    alternatePartNumbers: ["100C09D10"],
    specifications: {
      "Rated Current": "9 A",
      "Poles": "3",
      "Coil Voltage": "24V DC",
      "Aux Contact": "1 NO",
      "Mounting": "DIN Rail",
    },
    price: 68,
    stock: "in-stock",
  },
  {
    slug: "509-aod",
    partNumber: "509-AOD",
    name: "Bulletin 509 NEMA Full Voltage Starter",
    brand: "allen-bradley",
    categorySlug: "contactors-starters",
    shortSpecs: ["NEMA Size 0", "Ambient compensated overload", "600V rated"],
    description: [
      "Full-voltage non-reversing starter for NEMA-rated applications",
      "Ambient-compensated bimetallic overload relay",
      "Open or enclosed configurations available",
      "Broad horsepower rating range for general motor control",
    ],
    alternatePartNumbers: ["509AOD"],
    specifications: {
      "NEMA Size": "0",
      "Rated Voltage": "600V Max",
      "Overload Type": "Bimetallic",
      "Mounting": "Panel",
    },
    price: 145,
    stock: "in-stock",
  },
  {
    slug: "3rt2016-1bb41",
    partNumber: "3RT2016-1BB41",
    name: "SIRIUS 3RT2 Contactor 9A",
    brand: "siemens",
    categorySlug: "contactors-starters",
    shortSpecs: ["9 A AC-3", "24V DC coil", "S00 frame size"],
    description: [
      "Compact SIRIUS contactor for standard motor switching duty",
      "S00 frame size for space-constrained panel layouts",
      "Screw terminal connection standard, spring terminal optional",
      "Compatible with SIRIUS overload relay range",
    ],
    alternatePartNumbers: ["3RT2016-1B"],
    specifications: {
      "Rated Current AC-3": "9 A",
      "Frame Size": "S00",
      "Coil Voltage": "24V DC",
      "Mounting": "DIN Rail",
    },
    price: 52,
    stock: "in-stock",
  },
  {
    slug: "sd-t35",
    partNumber: "SD-T35",
    name: "Magnetic Contactor SD-T35",
    brand: "mitsubishi",
    categorySlug: "contactors-starters",
    shortSpecs: ["35 A rated", "3-pole", "AC coil"],
    description: [
      "General-purpose magnetic contactor for industrial motor loads",
      "Silver alloy contacts for extended electrical life",
      "Compact enclosure with DIN rail mounting foot",
      "Compatible with standard thermal overload relays",
    ],
    alternatePartNumbers: ["SDT35"],
    specifications: {
      "Rated Current": "35 A",
      "Poles": "3",
      "Coil Voltage": "200-240V AC",
      "Mounting": "DIN Rail",
    },
    price: 74,
    stock: "low-stock",
  },
  {
    slug: "j7kna-09",
    partNumber: "J7KNA-09",
    name: "Advanced Type Contactor J7KNA",
    brand: "omron",
    categorySlug: "contactors-starters",
    shortSpecs: ["9 A rated", "Low power coil", "Compact design"],
    description: [
      "Low-power-consumption electromagnetic contactor",
      "Reduced coil holding power minimizes panel heat load",
      "Push-in spring terminals for fast wiring",
      "UL/CSA and CE certified for global deployment",
    ],
    alternatePartNumbers: ["J7KNA09"],
    specifications: {
      "Rated Current": "9 A",
      "Poles": "3",
      "Coil Voltage": "24V DC",
      "Mounting": "DIN Rail",
    },
    price: 61,
    stock: "in-stock",
  },
  {
    slug: "lc1d09bd",
    partNumber: "LC1D09BD",
    name: "TeSys D Contactor 9A",
    brand: "schneider-electric",
    categorySlug: "contactors-starters",
    shortSpecs: ["9 A AC-3", "24V DC coil", "Everlink terminals"],
    description: [
      "TeSys D series contactor, industry-standard for motor control",
      "Everlink self-adjusting terminal technology prevents loosening",
      "1 NO auxiliary contact integrated",
      "Wide coil voltage range options available",
    ],
    alternatePartNumbers: ["LC1-D09BD"],
    specifications: {
      "Rated Current AC-3": "9 A",
      "Poles": "3",
      "Coil Voltage": "24V DC",
      "Aux Contact": "1 NO",
    },
    price: 58,
    stock: "in-stock",
  },

  // ---------------- Pneumatics (6) ----------------
  {
    slug: "150-c16nbd",
    partNumber: "150-C16NBD",
    name: "SMC-Type Solenoid Valve Bank Controller",
    brand: "allen-bradley",
    categorySlug: "pneumatics",
    shortSpecs: ["16 output points", "24V DC", "DIN rail mount"],
    description: [
      "Multi-point solenoid valve driver interface for pneumatic banks",
      "Short-circuit protected outputs with status LEDs",
      "Compact housing suited for control cabinet integration",
      "Screw terminal wiring for field connections",
    ],
    alternatePartNumbers: ["150C16NBD"],
    specifications: {
      "Output Points": "16",
      "Voltage": "24V DC",
      "Mounting": "DIN Rail",
      "Protection": "Short-Circuit",
    },
    price: 210,
    stock: "in-stock",
  },
  {
    slug: "6dr5010-0ng00-0aa0",
    partNumber: "6DR5010-0NG00-0AA0",
    name: "SIPART PS2 Electropneumatic Positioner",
    brand: "siemens",
    categorySlug: "pneumatics",
    shortSpecs: ["Single-acting", "4-20mA input", "Auto-calibration"],
    description: [
      "Electropneumatic positioner for control valve actuation",
      "Automatic self-calibration routine on commissioning",
      "Supports HART communication for diagnostics",
      "Rugged die-cast aluminum housing rated IP66",
    ],
    alternatePartNumbers: ["SIPART-PS2"],
    specifications: {
      "Input Signal": "4-20 mA",
      "Action Type": "Single-Acting",
      "Enclosure": "IP66",
      "Comm": "HART",
    },
    price: 890,
    stock: "low-stock",
  },
  {
    slug: "sy5120-5lzd",
    partNumber: "SY5120-5LZD",
    name: "5-Port Solenoid Valve SY5000 Series",
    brand: "mitsubishi",
    categorySlug: "pneumatics",
    shortSpecs: ["5-port 2-position", "24V DC", "Base mounted"],
    description: [
      "Compact 5-port solenoid valve for pneumatic actuator control",
      "Low power consumption coil for energy-efficient operation",
      "Manual override for maintenance and commissioning",
      "Wide range of body porting options",
    ],
    alternatePartNumbers: ["SY5120-5L"],
    specifications: {
      "Port Configuration": "5-Port, 2-Position",
      "Voltage": "24V DC",
      "Max Pressure": "0.7 MPa",
      "Mounting": "Base Mounted",
    },
    price: 95,
    stock: "in-stock",
  },
  {
    slug: "vex2131-5g-x2",
    partNumber: "VEX2131-5G-X2",
    name: "Compact Vacuum Ejector Unit",
    brand: "omron",
    categorySlug: "pneumatics",
    shortSpecs: ["Integrated ejector", "Vacuum switch built-in", "Compact body"],
    description: [
      "Integrated vacuum ejector for pick-and-place automation",
      "Built-in vacuum pressure switch with digital display",
      "Silencer and filter integrated into compact body",
      "Suitable for high-speed cycling applications",
    ],
    alternatePartNumbers: ["VEX2131"],
    specifications: {
      "Max Vacuum": "-90 kPa",
      "Supply Pressure": "0.3-0.5 MPa",
      "Switch Output": "PNP",
      "Mounting": "Bracket",
    },
    price: 165,
    stock: "in-stock",
  },
  {
    slug: "asco-8551-solenoid",
    partNumber: "8551A001MO",
    name: "ASCO Series 8551 Solenoid Valve",
    brand: "schneider-electric",
    categorySlug: "pneumatics",
    shortSpecs: ["3/2-way", "Direct acting", "Brass body"],
    description: [
      "Direct-acting 3/2-way solenoid valve for general pneumatic control",
      "Brass body construction for durability in industrial settings",
      "NEMA 4 rated coil enclosure for washdown areas",
      "Wide media and pressure compatibility range",
    ],
    alternatePartNumbers: ["ASCO8551A001MO"],
    specifications: {
      "Valve Type": "3/2-Way Direct Acting",
      "Body Material": "Brass",
      "Coil Enclosure": "NEMA 4",
      "Max Pressure": "150 psi",
    },
    price: 118,
    stock: "low-stock",
  },
  {
    slug: "danfoss-pvg32",
    partNumber: "PVG32-157B4472",
    name: "Danfoss PVG32 Proportional Valve Module",
    brand: "danfoss",
    categorySlug: "pneumatics",
    shortSpecs: ["Proportional flow control", "Load-sensing", "Modular stacking"],
    description: [
      "Proportional directional control valve for mobile/industrial hydraulics",
      "Load-sensing design maintains flow independent of pressure changes",
      "Modular stacking allows multi-function valve banks",
      "Electric or hydraulic actuation options",
    ],
    alternatePartNumbers: ["PVG32-157B"],
    specifications: {
      "Max Flow": "160 L/min",
      "Control Type": "Load-Sensing Proportional",
      "Actuation": "Electric/Hydraulic",
      "Mounting": "Modular Stack",
    },
    price: 1240,
    stock: "in-stock",
  },

  // ---------------- Safety Systems (6) ----------------
  {
    slug: "440r-n23132",
    partNumber: "440R-N23132",
    name: "Guardmaster Safety Relay",
    brand: "allen-bradley",
    categorySlug: "safety-systems",
    shortSpecs: ["Dual-channel input", "3 safety outputs", "Up to Cat 4 / PLe"],
    description: [
      "Configurable safety relay for E-stop and safety gate monitoring",
      "Dual-channel monitoring detects wiring faults automatically",
      "Achieves SIL3 / PLe / Category 4 safety ratings",
      "LED diagnostics for fast troubleshooting",
    ],
    alternatePartNumbers: ["440RN23132"],
    specifications: {
      "Safety Rating": "SIL3 / PLe / Cat 4",
      "Inputs": "Dual-Channel",
      "Outputs": "3 Safety, 1 Aux",
      "Mounting": "DIN Rail",
    },
    price: 285,
    stock: "in-stock",
  },
  {
    slug: "3se5-safety-switch",
    partNumber: "3SE5232-0LC05",
    name: "SIRIUS Safety Position Switch",
    brand: "siemens",
    categorySlug: "safety-systems",
    shortSpecs: ["Metal housing", "Positive break contacts", "IP67 rated"],
    description: [
      "Heavy-duty safety position switch for guard door monitoring",
      "Positive-break contact action ensures fail-safe operation",
      "Rugged die-cast metal housing rated IP67",
      "Multiple actuator head orientations available",
    ],
    alternatePartNumbers: ["3SE5232-0LC"],
    specifications: {
      "Enclosure": "IP67 Metal",
      "Contact Type": "Positive Break",
      "Rated Voltage": "230V AC",
      "Mounting": "Guard Door",
    },
    price: 195,
    stock: "in-stock",
  },
  {
    slug: "gr2-sl-safety-controller",
    partNumber: "GR2-SL",
    name: "Safety Light Curtain Controller",
    brand: "mitsubishi",
    categorySlug: "safety-systems",
    shortSpecs: ["Type 4 light curtain", "14mm resolution", "Muting function"],
    description: [
      "Type 4 safety light curtain for hazardous area access control",
      "Fine 14mm detection resolution for finger protection",
      "Integrated muting logic for material pass-through",
      "Self-diagnostic function with external device monitoring",
    ],
    alternatePartNumbers: ["GR2SL"],
    specifications: {
      "Safety Type": "Type 4",
      "Resolution": "14 mm",
      "Range": "0.3-7 m",
      "Mounting": "Bracket Kit",
    },
    price: 1050,
    stock: "low-stock",
  },
  {
    slug: "g9sa-safety-relay",
    partNumber: "G9SA-301",
    name: "G9SA Series Safety Relay Unit",
    brand: "omron",
    categorySlug: "safety-systems",
    shortSpecs: ["3 NO safety outputs", "24V AC/DC", "Slim 22.5mm housing"],
    description: [
      "Compact safety relay unit for E-stop and interlock circuits",
      "Slim 22.5mm housing saves panel space",
      "Auto/manual reset selectable via wiring",
      "TUV certified to EN ISO 13849-1",
    ],
    alternatePartNumbers: ["G9SA301"],
    specifications: {
      "Outputs": "3 NO Safety, 1 NC Aux",
      "Voltage": "24V AC/DC",
      "Width": "22.5 mm",
      "Mounting": "DIN Rail",
    },
    price: 130,
    stock: "in-stock",
  },
  {
    slug: "xcsta-safety-switch",
    partNumber: "XCSTA791",
    name: "Preventa XCS-TA Safety Switch",
    brand: "schneider-electric",
    categorySlug: "safety-systems",
    shortSpecs: ["Solenoid interlock", "IP67", "Emergency release"],
    description: [
      "Solenoid interlock switch for high-security guard door applications",
      "Manual emergency release override for personnel safety",
      "Rated IP67 for washdown and outdoor installations",
      "Compatible with Preventa safety relay range",
    ],
    alternatePartNumbers: ["XCS-TA791"],
    specifications: {
      "Enclosure": "IP67",
      "Interlock Type": "Solenoid",
      "Rated Voltage": "24V DC",
      "Mounting": "Guard Door",
    },
    price: 245,
    stock: "in-stock",
  },
  {
    slug: "danfoss-mcb-107-safety",
    partNumber: "MCB107-130B1102",
    name: "Danfoss MCB 107 Safe Stop Option",
    brand: "danfoss",
    categorySlug: "safety-systems",
    shortSpecs: ["STO SIL2", "Plug-in module", "For VLT drives"],
    description: [
      "Safe Torque Off option module for VLT drive series",
      "Certified SIL2 / PLd safety function per EN 61800-5-2",
      "Plug-in installation without external wiring changes",
      "Diagnostic LED status indicators on module face",
    ],
    alternatePartNumbers: ["MCB-107"],
    specifications: {
      "Safety Function": "STO SIL2 / PLd",
      "Installation": "Plug-In Module",
      "Compatible Series": "VLT Drives",
      "Mounting": "Drive Slot",
    },
    price: 310,
    stock: "out-of-stock",
  },

  // ---------------- Power Supplies (6) ----------------
  {
    slug: "1606-xle120e",
    partNumber: "1606-XLE120E",
    name: "Performance Power Supply 120W 24V",
    brand: "allen-bradley",
    categorySlug: "power-supplies",
    shortSpecs: ["120W output", "24V DC / 5A", "Wide input range"],
    description: [
      "Compact switched-mode power supply for panel-mounted electronics",
      "Universal AC input auto-ranging from 85-264V",
      "Screw terminal connections for fast field wiring",
      "Overload and short-circuit protected output",
    ],
    alternatePartNumbers: ["1606XLE120E"],
    specifications: {
      "Output Power": "120 W",
      "Output Voltage": "24V DC",
      "Output Current": "5 A",
      "Input Voltage": "85-264V AC",
      "Mounting": "DIN Rail",
    },
    price: 155,
    stock: "in-stock",
  },
  {
    slug: "sitop-psu100l",
    partNumber: "6EP1333-3BA10",
    name: "SITOP PSU100L 24V/5A Power Supply",
    brand: "siemens",
    categorySlug: "power-supplies",
    shortSpecs: ["120W output", "High efficiency", "LED status display"],
    description: [
      "Single-phase stabilized power supply for control cabinets",
      "High conversion efficiency reduces cabinet heat load",
      "Green LED status display for quick diagnostics",
      "Push-in spring terminals for vibration-resistant wiring",
    ],
    alternatePartNumbers: ["PSU100L-24-5"],
    specifications: {
      "Output Power": "120 W",
      "Output Voltage": "24V DC",
      "Output Current": "5 A",
      "Input Voltage": "120-230V AC",
      "Mounting": "DIN Rail",
    },
    price: 140,
    stock: "in-stock",
  },
  {
    slug: "melipc-power-24v",
    partNumber: "MDS-D-PS10",
    name: "MELSERVO Regenerative Power Supply Unit",
    brand: "mitsubishi",
    categorySlug: "power-supplies",
    shortSpecs: ["10 kW capacity", "Regenerative braking", "For servo systems"],
    description: [
      "Power supply unit for multi-axis servo drive systems",
      "Regenerative energy conversion reduces braking resistor load",
      "Shared DC bus configuration for coordinated axes",
      "Built-in overvoltage and overcurrent protection",
    ],
    alternatePartNumbers: ["MDSDPS10"],
    specifications: {
      "Capacity": "10 kW",
      "Input Voltage": "200-230V 3-Phase",
      "Function": "Regenerative",
      "Mounting": "Panel",
    },
    price: 2150,
    stock: "low-stock",
  },
  {
    slug: "s8vk-g06024",
    partNumber: "S8VK-G06024",
    name: "S8VK-G Series Switching Power Supply",
    brand: "omron",
    categorySlug: "power-supplies",
    shortSpecs: ["60W output", "24V DC / 2.5A", "Slim design"],
    description: [
      "Slim-profile switching power supply for compact enclosures",
      "Global AC input compatibility, no voltage selector needed",
      "PFC circuit improves power factor and efficiency",
      "5-year manufacturer design life rating",
    ],
    alternatePartNumbers: ["S8VKG06024"],
    specifications: {
      "Output Power": "60 W",
      "Output Voltage": "24V DC",
      "Output Current": "2.5 A",
      "Input Voltage": "100-240V AC",
      "Mounting": "DIN Rail",
    },
    price: 85,
    stock: "in-stock",
  },
  {
    slug: "abl2rem24050",
    partNumber: "ABL2REM24050",
    name: "Phaseo ABL2 Regulated Power Supply",
    brand: "schneider-electric",
    categorySlug: "power-supplies",
    shortSpecs: ["50W output", "24V DC / 2.1A", "Single-phase input"],
    description: [
      "Regulated switch-mode power supply for control circuits",
      "Compact modular housing for space-constrained cabinets",
      "Green LED indicates output status at a glance",
      "Wide operating temperature range for industrial use",
    ],
    alternatePartNumbers: ["ABL2-REM24050"],
    specifications: {
      "Output Power": "50 W",
      "Output Voltage": "24V DC",
      "Output Current": "2.1 A",
      "Input Voltage": "100-240V AC",
      "Mounting": "DIN Rail",
    },
    price: 72,
    stock: "in-stock",
  },
  {
    slug: "danfoss-mcf-107-brake",
    partNumber: "MCF107-130B1112",
    name: "Danfoss MCF 107 Brake Resistor Option",
    brand: "danfoss",
    categorySlug: "power-supplies",
    shortSpecs: ["Brake chopper option", "Plug-in module", "For VLT drives"],
    description: [
      "Brake chopper power option for dynamic braking applications",
      "Plug-in installation directly onto VLT drive backplane",
      "Thermal protection prevents resistor overheating",
      "Compact form factor minimizes cabinet footprint",
    ],
    alternatePartNumbers: ["MCF-107"],
    specifications: {
      "Function": "Brake Chopper",
      "Compatible Series": "VLT Drives",
      "Installation": "Plug-In Module",
      "Mounting": "Drive Slot",
    },
    price: 265,
    stock: "low-stock",
  },

  // ---------------- Sensors & Switches (6) ----------------
  {
    slug: "873c-df3ne18-a2",
    partNumber: "873C-DF3NE18-A2",
    name: "Compact Inductive Proximity Sensor 18mm",
    brand: "allen-bradley",
    categorySlug: "sensors-switches",
    shortSpecs: ["18mm barrel", "8mm sensing range", "PNP NO/NC"],
    description: [
      "Cylindrical inductive proximity sensor for metal target detection",
      "Rugged stainless steel housing rated IP67",
      "PNP output configurable NO or NC via wiring",
      "Short-circuit and reverse-polarity protected",
    ],
    alternatePartNumbers: ["873CDF3NE18A2"],
    specifications: {
      "Sensing Range": "8 mm",
      "Housing Size": "18 mm",
      "Output": "PNP NO/NC",
      "Enclosure": "IP67",
    },
    price: 45,
    stock: "in-stock",
  },
  {
    slug: "3rg4-photoelectric",
    partNumber: "3RG4023-0AB01",
    name: "SIMATIC Photoelectric Sensor Diffuse",
    brand: "siemens",
    categorySlug: "sensors-switches",
    shortSpecs: ["Diffuse reflective", "0.1-1m range", "M18 housing"],
    description: [
      "Diffuse reflective photoelectric sensor for object detection",
      "Background suppression reduces false triggers",
      "M18 threaded housing for standard bracket mounting",
      "Visible red light spot for easy alignment",
    ],
    alternatePartNumbers: ["3RG4023-0AB"],
    specifications: {
      "Sensing Range": "0.1-1 m",
      "Housing": "M18 Threaded",
      "Output": "PNP",
      "Enclosure": "IP67",
    },
    price: 58,
    stock: "in-stock",
  },
  {
    slug: "ex-20a-photoelectric",
    partNumber: "EX-20A",
    name: "Fiber Optic Amplifier Unit EX-20",
    brand: "mitsubishi",
    categorySlug: "sensors-switches",
    shortSpecs: ["Fiber optic input", "High-speed response", "Digital display"],
    description: [
      "Fiber optic sensor amplifier for tight-space detection tasks",
      "High-speed response suited to high-throughput lines",
      "Digital numeric display for threshold setting",
      "Compatible with wide range of fiber optic cable heads",
    ],
    alternatePartNumbers: ["EX20A"],
    specifications: {
      "Response Time": "0.5 ms",
      "Display": "Digital Numeric",
      "Output": "NPN/PNP Selectable",
      "Mounting": "DIN Rail",
    },
    price: 96,
    stock: "low-stock",
  },
  {
    slug: "e2e2-x10md1",
    partNumber: "E2E2-X10MD1",
    name: "Cylindrical Proximity Sensor 10mm",
    brand: "omron",
    categorySlug: "sensors-switches",
    shortSpecs: ["10mm sensing", "DC 2-wire", "M18 threaded body"],
    description: [
      "Long-range inductive proximity sensor for automation lines",
      "2-wire DC connection simplifies field wiring",
      "Extended sensing distance for non-flush mounting",
      "Wide operating temperature range -25 to 70°C",
    ],
    alternatePartNumbers: ["E2E2X10MD1"],
    specifications: {
      "Sensing Range": "10 mm",
      "Wiring": "DC 2-Wire",
      "Housing": "M18 Threaded",
      "Enclosure": "IP67",
    },
    price: 51,
    stock: "in-stock",
  },
  {
    slug: "xs4p1a1pal2",
    partNumber: "XS4P1A1PAL2",
    name: "OsiSense XS4 Inductive Sensor",
    brand: "schneider-electric",
    categorySlug: "sensors-switches",
    shortSpecs: ["Cylindrical M18", "4mm sensing", "3-wire PNP"],
    description: [
      "Cylindrical inductive sensor for compact machine mounting",
      "Nickel-plated brass housing resists corrosion",
      "Short-circuit protected 3-wire PNP output",
      "LED indicator for target detection status",
    ],
    alternatePartNumbers: ["XS4-P1A1PAL2"],
    specifications: {
      "Sensing Range": "4 mm",
      "Housing": "M18 Threaded",
      "Output": "3-Wire PNP",
      "Enclosure": "IP67",
    },
    price: 47,
    stock: "in-stock",
  },
  {
    slug: "danfoss-mbs3000-pressure",
    partNumber: "MBS3000-1611-1AB04",
    name: "Danfoss MBS 3000 Pressure Transmitter",
    brand: "danfoss",
    categorySlug: "sensors-switches",
    shortSpecs: ["0-16 bar range", "4-20mA output", "Stainless steel"],
    description: [
      "Robust pressure transmitter for hydraulic and pneumatic systems",
      "All-stainless-steel wetted parts resist corrosive media",
      "4-20mA analog output for direct PLC integration",
      "High overload and burst pressure resistance",
    ],
    alternatePartNumbers: ["MBS3000-1611"],
    specifications: {
      "Pressure Range": "0-16 bar",
      "Output": "4-20 mA",
      "Wetted Parts": "Stainless Steel",
      "Enclosure": "IP65",
    },
    price: 175,
    stock: "in-stock",
  },
];

// Sanity check at module load (dev-time only signal, not thrown to avoid breaking prod builds)
if (productSeeds.length !== 48) {
  // eslint-disable-next-line no-console
  console.warn(`Expected 48 product seeds, found ${productSeeds.length}`);
}

// Rotate rank assignment: 8 products each for week/month/year top-seller tabs.
const weekRankSlugs = [
  "1756-l61",
  "powerflex-525-5hp",
  "panelview-800-7in",
  "100-c09d10",
  "150-c16nbd",
  "440r-n23132",
  "1606-xle120e",
  "873c-df3ne18-a2",
];
const monthRankSlugs = [
  "s7-1200-cpu-1214c",
  "sinamics-g120c",
  "simatic-ktp700-basic",
  "3rt2016-1bb41",
  "sy5120-5lzd",
  "3se5-safety-switch",
  "sitop-psu100l",
  "3rg4-photoelectric",
];
const yearRankSlugs = [
  "1769-l33er",
  "powerflex-753-25hp",
  "panelview-plus-7-1000",
  "509-aod",
  "vex2131-5g-x2",
  "g9sa-safety-relay",
  "s8vk-g06024",
  "e2e2-x10md1",
];

export const products: Product[] = productSeeds.map((seed) => {
  const image = `/images/products/${seed.categorySlug}.svg`;
  const weekIdx = weekRankSlugs.indexOf(seed.slug);
  const monthIdx = monthRankSlugs.indexOf(seed.slug);
  const yearIdx = yearRankSlugs.indexOf(seed.slug);
  return {
    slug: seed.slug,
    partNumber: seed.partNumber,
    name: seed.name,
    brand: seed.brand,
    categorySlug: seed.categorySlug,
    image,
    gallery: [image, image, image],
    shortSpecs: seed.shortSpecs,
    description: seed.description,
    alternatePartNumbers: seed.alternatePartNumbers,
    specifications: seed.specifications,
    price: seed.price,
    stock: seed.stock,
    warrantyYears: 2,
    ...(weekIdx !== -1 ? { weekRank: weekIdx + 1 } : {}),
    ...(monthIdx !== -1 ? { monthRank: monthIdx + 1 } : {}),
    ...(yearIdx !== -1 ? { yearRank: yearIdx + 1 } : {}),
  };
});

export const categories: Category[] = categoryDefs.map((c) => ({
  ...c,
  productCount: products.filter((p) => p.categorySlug === c.slug).length,
}));

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export const reviews: Review[] = [
  {
    id: "rev-1",
    author: "Rezaul Karim",
    country: "Bangladesh",
    rating: 5,
    text: "Alliance sourced a discontinued Allen Bradley module for us within a week. Excellent communication throughout.",
  },
  {
    id: "rev-2",
    author: "Ahmed Al-Farsi",
    country: "UAE",
    rating: 5,
    text: "Fast quotation turnaround and the parts arrived exactly as specified. Will order again for our next plant expansion.",
  },
  {
    id: "rev-3",
    author: "Michael Turner",
    country: "USA",
    rating: 4,
    text: "Good pricing on Siemens drives compared to local distributors. Shipping took a bit longer than expected but support kept us updated.",
  },
  {
    id: "rev-4",
    author: "James Whitfield",
    country: "UK",
    rating: 5,
    text: "Their technical team helped us cross-reference an obsolete part number to a current equivalent. Saved us a costly redesign.",
  },
  {
    id: "rev-5",
    author: "Klaus Bergmann",
    country: "Germany",
    rating: 4,
    text: "Reliable supplier for HMI panels. Documentation and warranty terms were clear and honored without issue.",
  },
  {
    id: "rev-6",
    author: "Priya Nair",
    country: "India",
    rating: 5,
    text: "Ordered sensors and contactors in bulk for a factory retrofit. Everything arrived well packaged and on schedule.",
  },
];

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export const faqs: FaqItem[] = [
  {
    question: "Do you ship internationally?",
    answer:
      "Yes. Alliance ships worldwide from our Dhaka, Bangladesh facility via air and sea freight, with door-to-door courier options available for smaller orders.",
  },
  {
    question: "How does the quotation process work?",
    answer:
      "Select a product, choose your quantity, and submit a quotation request with your contact details. Our team reviews stock and pricing and you'll receive a formal quote to confirm before we process your order.",
  },
  {
    question: "What warranty do your products carry?",
    answer:
      "Most parts carry a standard 2-year manufacturer warranty covering defects in materials and workmanship. Extended warranty terms are available on request for select product lines.",
  },
  {
    question: "What payment terms do you offer?",
    answer:
      "We accept bank transfer (T/T), letter of credit (L/C) for larger orders, and major payment cards for smaller quotations. Payment terms are confirmed at order confirmation.",
  },
  {
    question: "What are your typical lead times?",
    answer:
      "In-stock items typically ship within 1-2 business days. Special-order or low-stock items may take 1-3 weeks depending on manufacturer availability — lead time is confirmed on your quotation.",
  },
  {
    question: "What is your returns policy?",
    answer:
      "Unused parts in original packaging may be returned within 14 days of delivery for eligible products. Contact our support team with your order number to initiate a return.",
  },
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(slug: string): Product[] {
  return products.filter((p) => p.categorySlug === slug);
}

export function getTopSelling(period: "week" | "month" | "year"): Product[] {
  const rankKey = period === "week" ? "weekRank" : period === "month" ? "monthRank" : "yearRank";
  return products
    .filter((p) => p[rankKey] !== undefined)
    .sort((a, b) => (a[rankKey] as number) - (b[rankKey] as number))
    .slice(0, 6);
}

export function getRelatedProducts(slug: string): Product[] {
  const product = getProductBySlug(slug);
  if (!product) return [];
  return products
    .filter((p) => p.slug !== slug && p.categorySlug === product.categorySlug)
    .slice(0, 4);
}
