/* ==========================================================================
   OmniTool Kit - Intel 8085 Microprocessor Lab & Simulator Engine
   ========================================================================== */

// Global state variables
let registers = { A: 0, B: 0, C: 0, D: 0, E: 0, H: 0, L: 0 };
let PC = 0x2000;
let SP = 0xFFFF;
let flags = { S: 0, Z: 0, AC: 0, P: 0, CY: 0 };
let memory = new Uint8Array(65536);

let isAssembled = false;
let loadAddress = 0x2000;
let lineToAddressMap = {}; // Maps source code lines (0-indexed) to PC addresses
let addressToLineMap = {}; // Maps PC addresses to source code line numbers
let compiledInstructions = {}; // Maps address to string instructions
let labelsTable = {};

let currentTab = "registers";
let runTimer = null;
const MAX_STEPS = 10000; // infinite loop guard

// Code templates
const TEMPLATES = {
  addition: `; 8-Bit Addition
LXI H, 3000H  ; HL points to 3000H
MOV A, M      ; Load first number from memory
INX H         ; HL points to 3001H
ADD M         ; Add second number
INX H         ; HL points to 3002H
MOV M, A      ; Store result in 3002H
HLT           ; Stop`,

  subtraction: `; 8-Bit Subtraction
LXI H, 3000H  ; HL points to 3000H
MOV A, M      ; Load first operand
INX H         ; HL points to 3001H
SUB M         ; Subtract second operand
INX H         ; HL points to 3002H
MOV M, A      ; Store difference in 3002H
HLT           ; Halt`,

  "block-transfer": `; Block Data Transfer (10 Bytes)
LXI H, 3000H  ; Source address
LXI D, 4000H  ; Destination address
MVI C, 0AH    ; Load counter = 10 (0AH)
LOOP: MOV A, M ; Load byte from source
STAX D        ; Store at destination
INX H         ; Increment source pointer
INX D         ; Increment destination pointer
DCR C         ; Decrement counter
JNZ LOOP      ; Repeat if counter != 0
HLT           ; Halt`,

  "find-max": `; Find Maximum Element in Array of 5 Bytes
LXI H, 3000H  ; Pointer to array size location
MOV C, M      ; C = size of array (e.g. 05H at 3000H)
DCR C         ; Decrement counter by 1
INX H         ; HL points to first array element
MOV A, M      ; Set initial max value in A
LOOP: INX H   ; Point to next element
CMP M         ; Compare A with next element
JNC SKIP      ; If A >= M, skip update
MOV A, M      ; If A < M, update max value
SKIP: DCR C   ; Decrement loop counter
JNZ LOOP      ; Repeat
STA 3100H     ; Store max value at 3100H
HLT           ; Halt`,

  multiplication: `; 8-Bit Multiplication (Successive Addition)
LDA 3000H     ; Load first number
MOV B, A      ; Copy to register B
LDA 3001H     ; Load multiplier
MOV C, A      ; Copy to register C
MVI A, 00H    ; Clear accumulator (A = 0)
LOOP: ADD B   ; Add B repeatedly
DCR C         ; Decrement counter C
JNZ LOOP      ; Loop until C is 0
STA 3002H     ; Store result at 3002H
HLT           ; Halt`,

  fibonacci: `; Generate Fibonacci Series (8 terms)
MVI C, 08H    ; C = count of terms (08H)
LXI H, 3000H  ; Destination memory pointer
MVI A, 00H    ; F0 = 0
MOV M, A      ; Store F0
INX H         ; Point to next address
MVI B, 01H    ; F1 = 1
MOV M, B      ; Store F1
DCR C         ; Decrement counter for F0
DCR C         ; Decrement counter for F1
LOOP: ADD B   ; Next term (A = F_n-1 + F_n-2)
INX H         ; Point to next location
MOV M, A      ; Store term
MOV D, B      ; Temp save B
MOV B, A      ; Update B = F_n-1
MOV A, D      ; A = F_n-2 (restored for next addition)
DCR C         ; Decrement counter
JNZ LOOP      ; Repeat
HLT           ; Halt`
};

// Start binding UI elements
function update8085Ui() {
  init8085UiOnce();
  drawMemoryGrid();
  drawRegisters();
}

let isInitialized = false;
function init8085UiOnce() {
  if (isInitialized) return;
  isInitialized = true;

  const editor = document.getElementById("assemblyEditor");
  const templateSelect = document.getElementById("assemblyTemplates");
  const lineNumbers = document.getElementById("editorLineNumbers");
  
  // UI Tabs navigation
  document.querySelectorAll(".debug-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".debug-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      const targetTab = tab.getAttribute("data-tab");
      currentTab = targetTab;
      
      document.querySelectorAll(".debug-tab-content").forEach(c => c.classList.remove("active"));
      document.getElementById(`tab-${targetTab}`).classList.add("active");
      
      if (targetTab === "memory") {
        drawMemoryGrid();
      }
    });
  });

  // Align Line Numbers in Editor
  const syncLineNumbers = () => {
    const lines = editor.value.split("\n").length;
    let numberHtml = "";
    for (let i = 1; i <= lines; i++) {
      numberHtml += `<div>${i}</div>`;
    }
    lineNumbers.innerHTML = numberHtml;
  };
  editor.addEventListener("input", syncLineNumbers);
  syncLineNumbers();

  // Template select trigger
  templateSelect.addEventListener("change", (e) => {
    const templateKey = e.target.value;
    if (TEMPLATES[templateKey]) {
      editor.value = TEMPLATES[templateKey];
      syncLineNumbers();
      resetCpu();
      window.showToast("Loaded template code", "info");
    }
  });

  // Action Buttons
  document.getElementById("assembleBtn").addEventListener("click", assembleCode);
  document.getElementById("runCpuBtn").addEventListener("click", runCode);
  document.getElementById("stepCpuBtn").addEventListener("click", stepCode);
  document.getElementById("resetCpuBtn").addEventListener("click", resetCpu);

  // Memory view actions
  document.getElementById("memUpdateBtn").addEventListener("click", drawMemoryGrid);
  
  const memSearchInput = document.getElementById("memSearchAddr");
  memSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const addrHex = memSearchInput.value.trim();
      const addr = parseInt(addrHex, 16);
      if (!isNaN(addr) && addr >= 0 && addr <= 0xFFFF) {
        document.getElementById("memLoadAddr").value = addr.toString(16).toUpperCase();
        drawMemoryGrid();
        
        // Highlight search target row if rendered
        const row = document.getElementById(`mem-row-${addr.toString(16).toUpperCase()}`);
        if (row) {
          row.scrollIntoView({ behavior: "smooth", block: "center" });
          row.classList.add("mem-row-active");
          setTimeout(() => row.classList.remove("mem-row-active"), 2000);
        }
      } else {
        window.showToast("Invalid Hex Address (0000 - FFFF)", "error");
      }
    }
  });

  // Mock preloaded memories for default laboratory exercises
  memory[0x3000] = 0x05; // Operands
  memory[0x3001] = 0x07;
  memory[0x3002] = 0x00;
}

// Global register mappings helper
const REG_CODES = { B: 0, C: 1, D: 2, E: 3, H: 4, L: 5, M: 6, A: 7 };
const RP_CODES = { B: 0, BC: 0, D: 1, DE: 1, H: 2, HL: 2, SP: 3 };

function parseHexOrDec(valStr) {
  if (!valStr) return NaN;
  valStr = valStr.trim().toUpperCase();
  if (valStr.endsWith("H")) {
    return parseInt(valStr.slice(0, -1), 16);
  }
  if (valStr.startsWith("0X")) {
    return parseInt(valStr, 16);
  }
  return parseInt(valStr, 10);
}

/* ==========================================================================
   Two-Pass Assembler
   ========================================================================== */
function assembleCode() {
  const code = document.getElementById("assemblyEditor").value;
  const consoleLog = document.getElementById("consoleLog");
  
  consoleLog.innerHTML = "Assembling code...\n";
  labelsTable = {};
  lineToAddressMap = {};
  addressToLineMap = {};
  compiledInstructions = {};
  
  const rawLines = code.split("\n");
  const parsedLines = []; // Items: { label, mnemonic, operands, originalLineIndex, size }

  // 1. Pass 1: Parse instructions, clean up comments, map labels and define byte lengths
  let currentPC = 0x2000;
  loadAddress = currentPC;

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i].split(";")[0].trim(); // Strip comment
    if (line === "") continue;

    // Check for Label
    let label = null;
    if (line.includes(":")) {
      const idx = line.indexOf(":");
      label = line.substring(0, idx).trim().toUpperCase();
      line = line.substring(idx + 1).trim();
      if (label === "") {
        consoleLog.innerHTML += `<span style="color:var(--color-error)">Line ${i + 1}: Empty label name!</span>\n`;
        return;
      }
      labelsTable[label] = currentPC;
    }

    if (line === "") {
      // Just a label line
      continue;
    }

    // Split Mnemonic and Operands
    const spaceIdx = line.indexOf(" ");
    let mnemonic = "";
    let operandStr = "";
    if (spaceIdx === -1) {
      mnemonic = line.toUpperCase();
    } else {
      mnemonic = line.substring(0, spaceIdx).trim().toUpperCase();
      operandStr = line.substring(spaceIdx + 1).trim();
    }

    const operands = operandStr === "" ? [] : operandStr.split(",").map(s => s.trim().toUpperCase());

    // Calculate Instruction Byte Size
    let size = getInstructionSize(mnemonic, operands);
    if (size === 0) {
      consoleLog.innerHTML += `<span style="color:var(--color-error)">Line ${i + 1}: Syntax or Mnemonic Error "${mnemonic}"</span>\n`;
      return;
    }

    parsedLines.push({
      label,
      mnemonic,
      operands,
      originalLineIndex: i,
      address: currentPC,
      size
    });

    lineToAddressMap[i] = currentPC;
    addressToLineMap[currentPC] = i;
    
    currentPC += size;
  }

  // 2. Pass 2: Translate Mnemonics to machine code bytes and write into simulated RAM
  // Clear program area in memory (from loadAddress to loadAddress + 256)
  for (let a = loadAddress; a < loadAddress + 512; a++) {
    memory[a] = 0;
  }

  for (let i = 0; i < parsedLines.length; i++) {
    const item = parsedLines[i];
    const writePtr = item.address;
    
    const bytes = compileLineToHex(item);
    if (!bytes || bytes.length !== item.size) {
      consoleLog.innerHTML += `<span style="color:var(--color-error)">Line ${item.originalLineIndex + 1}: Opcode generation failed for "${item.mnemonic}"</span>\n`;
      return;
    }

    // Write bytes into simulated memory
    for (let b = 0; b < bytes.length; b++) {
      memory[writePtr + b] = bytes[b];
    }

    // Save metadata format for viewer display column
    let formatStr = item.mnemonic + " " + item.operands.join(", ");
    compiledInstructions[writePtr] = formatStr;
  }

  // Set running state
  isAssembled = true;
  PC = loadAddress;
  SP = 0xFFFF;
  
  // Enable running controls
  document.getElementById("runCpuBtn").removeAttribute("disabled");
  document.getElementById("runCpuBtn").classList.remove("disabled");
  document.getElementById("stepCpuBtn").removeAttribute("disabled");
  document.getElementById("stepCpuBtn").classList.remove("disabled");

  consoleLog.innerHTML += `<span style="color:var(--color-success)">Assembly Successful! loaded at 2000H.</span>\n`;
  
  drawMemoryGrid();
  drawRegisters();
  highlightEditorLine(addressToLineMap[PC]);
}

function getInstructionSize(mnemonic, operands) {
  // 1-Byte Instructions
  if (["HLT", "NOP", "CMA", "CMC", "STC", "XCHG"].includes(mnemonic)) return 1;
  if (mnemonic === "MOV" && operands.length === 2 && REG_CODES[operands[0]] !== undefined && REG_CODES[operands[1]] !== undefined) return 1;
  if (["ADD", "SUB", "CMP", "ANA", "XRA", "ORA"].includes(mnemonic) && operands.length === 1 && REG_CODES[operands[0]] !== undefined) return 1;
  if (["INR", "DCR"].includes(mnemonic) && operands.length === 1 && REG_CODES[operands[0]] !== undefined) return 1;
  if (["INX", "DCX", "DAD"].includes(mnemonic) && operands.length === 1 && RP_CODES[operands[0]] !== undefined) return 1;
  if (["STAX", "LDAX"].includes(mnemonic) && operands.length === 1 && (operands[0] === "B" || operands[0] === "D")) return 1;

  // 2-Byte Instructions
  if (mnemonic === "MVI" && operands.length === 2 && REG_CODES[operands[0]] !== undefined) return 2;
  if (["ADI", "SUI", "CPI", "ANI", "XRI", "ORI"].includes(mnemonic) && operands.length === 1) return 2;

  // 3-Byte Instructions
  if (mnemonic === "LXI" && operands.length === 2 && RP_CODES[operands[0]] !== undefined) return 3;
  if (["LDA", "STA", "LHLD", "SHLD"].includes(mnemonic) && operands.length === 1) return 3;
  if (["JMP", "JZ", "JNZ", "JC", "JNC", "JP", "JM", "JPE", "JPO"].includes(mnemonic) && operands.length === 1) return 3;

  return 0; // Error / Unrecognized
}

function compileLineToHex(item) {
  const { mnemonic, operands } = item;
  const bytes = [];

  try {
    if (mnemonic === "NOP") return [0x00];
    if (mnemonic === "HLT") return [0x76];
    if (mnemonic === "CMA") return [0x2F];
    if (mnemonic === "CMC") return [0x3F];
    if (mnemonic === "STC") return [0x37];
    if (mnemonic === "XCHG") return [0xEB];

    if (mnemonic === "MOV") {
      const rd = REG_CODES[operands[0]];
      const rs = REG_CODES[operands[1]];
      return [0x40 + (rd << 3) + rs];
    }

    if (["ADD", "SUB", "CMP", "ANA", "XRA", "ORA"].includes(mnemonic)) {
      const r = REG_CODES[operands[0]];
      let base = 0x80;
      if (mnemonic === "SUB") base = 0x90;
      else if (mnemonic === "ANA") base = 0xA0;
      else if (mnemonic === "XRA") base = 0xA8;
      else if (mnemonic === "ORA") base = 0xB0;
      else if (mnemonic === "CMP") base = 0xB8;
      return [base + r];
    }

    if (["INR", "DCR"].includes(mnemonic)) {
      const r = REG_CODES[operands[0]];
      const base = mnemonic === "INR" ? 0x04 : 0x05;
      return [base + (r << 3)];
    }

    if (["INX", "DCX", "DAD"].includes(mnemonic)) {
      const rp = RP_CODES[operands[0]];
      let base = 0x03;
      if (mnemonic === "DCX") base = 0x0B;
      else if (mnemonic === "DAD") base = 0x09;
      return [base + (rp << 4)];
    }

    if (mnemonic === "STAX") return [operands[0] === "B" ? 0x02 : 0x12];
    if (mnemonic === "LDAX") return [operands[0] === "B" ? 0x0A : 0x1A];

    // 2-Byte Instructions
    if (mnemonic === "MVI") {
      const r = REG_CODES[operands[0]];
      const val = parseHexOrDec(operands[1]);
      if (isNaN(val)) return null;
      return [0x06 + (r << 3), val & 0xFF];
    }

    if (["ADI", "SUI", "CPI", "ANI", "XRI", "ORI"].includes(mnemonic)) {
      const val = parseHexOrDec(operands[0]);
      if (isNaN(val)) return null;
      let base = 0xC6; // ADI
      if (mnemonic === "SUI") base = 0xD6;
      else if (mnemonic === "ANI") base = 0xE6;
      else if (mnemonic === "XRI") base = 0xEE;
      else if (mnemonic === "ORI") base = 0xF6;
      else if (mnemonic === "CPI") base = 0xFE;
      return [base, val & 0xFF];
    }

    // 3-Byte Instructions
    if (mnemonic === "LXI") {
      const rp = RP_CODES[operands[0]];
      const val = parseHexOrDec(operands[1]);
      if (isNaN(val)) return null;
      return [0x01 + (rp << 4), val & 0xFF, (val >> 8) & 0xFF]; // Little Endian
    }

    if (["LDA", "STA", "LHLD", "SHLD"].includes(mnemonic)) {
      const val = parseHexOrDec(operands[0]);
      if (isNaN(val)) return null;
      let base = 0x3A; // LDA
      if (mnemonic === "STA") base = 0x32;
      else if (mnemonic === "LHLD") base = 0x2A;
      else if (mnemonic === "SHLD") base = 0x22;
      return [base, val & 0xFF, (val >> 8) & 0xFF];
    }

    if (["JMP", "JZ", "JNZ", "JC", "JNC", "JP", "JM", "JPE", "JPO"].includes(mnemonic)) {
      let targetAddr = 0;
      const targetLabel = operands[0];
      
      if (labelsTable[targetLabel] !== undefined) {
        targetAddr = labelsTable[targetLabel];
      } else {
        targetAddr = parseHexOrDec(targetLabel);
      }
      
      if (isNaN(targetAddr)) return null;

      let base = 0xC3; // JMP
      if (mnemonic === "JZ") base = 0xCA;
      else if (mnemonic === "JNZ") base = 0xC2;
      else if (mnemonic === "JC") base = 0xDA;
      else if (mnemonic === "JNC") base = 0xD2;
      else if (mnemonic === "JP") base = 0xF2;
      else if (mnemonic === "JM") base = 0xFA;
      else if (mnemonic === "JPE") base = 0xEA;
      else if (mnemonic === "JPO") base = 0xE2;

      return [base, targetAddr & 0xFF, (targetAddr >> 8) & 0xFF];
    }
  } catch (e) {
    return null;
  }

  return null;
}

/* ==========================================================================
   CPU Interpreter logic
   ========================================================================== */
function executeStep() {
  if (!isAssembled) return false;

  const consoleLog = document.getElementById("consoleLog");
  const opcode = memory[PC];

  // Inf security halt
  if (opcode === 0x76) {
    consoleLog.innerHTML += `Program Halted (HLT) at ${PC.toString(16).toUpperCase()}H\n`;
    return false;
  }

  const op1 = memory[PC + 1];
  const op2 = memory[PC + 2];
  
  // Trace parameters
  let instrLength = 1;
  const decodedStr = compiledInstructions[PC] || `DB ${opcode.toString(16).toUpperCase()}H`;
  consoleLog.innerHTML += `[${PC.toString(16).toUpperCase()}H]: ${decodedStr}\n`;

  // Decode opcode categories
  let baseOpcode = opcode;
  
  // 1. MOV Rd, Rs (0x40 - 0x7F except HLT 0x76)
  if (opcode >= 0x40 && opcode <= 0x7F && opcode !== 0x76) {
    const rdCode = (opcode - 0x40) >> 3;
    const rsCode = (opcode - 0x40) & 7;
    
    const val = getRegisterVal(rsCode);
    setRegisterVal(rdCode, val);
    instrLength = 1;
  }
  // 2. MVI R, Data (0x06, 0x0E, 0x16, 0x1E, 0x26, 0x2E, 0x36, 0x3E)
  else if ((opcode & 7) === 6 && opcode >= 0 && opcode <= 0x3E) {
    const rCode = opcode >> 3;
    setRegisterVal(rCode, op1);
    instrLength = 2;
  }
  // 3. LXI rp, Data16 (0x01, 0x11, 0x21, 0x31)
  else if ((opcode & 0xCF) === 1) {
    const rp = (opcode - 1) >> 4;
    const val16 = (op2 << 8) | op1;
    setRegisterPairVal(rp, val16);
    instrLength = 3;
  }
  // 4. ADD R (0x80 - 0x87)
  else if (opcode >= 0x80 && opcode <= 0x87) {
    const r = opcode & 7;
    const val = getRegisterVal(r);
    add8Bit(val);
    instrLength = 1;
  }
  // 5. ADI Data8 (0xC6)
  else if (opcode === 0xC6) {
    add8Bit(op1);
    instrLength = 2;
  }
  // 6. SUB R (0x90 - 0x97)
  else if (opcode >= 0x90 && opcode <= 0x97) {
    const r = opcode & 7;
    const val = getRegisterVal(r);
    sub8Bit(val);
    instrLength = 1;
  }
  // 7. SUI Data8 (0xD6)
  else if (opcode === 0xD6) {
    sub8Bit(op1);
    instrLength = 2;
  }
  // 8. INR R (0x04 + R<<3)
  else if ((opcode & 7) === 4 && opcode >= 0 && opcode <= 0x3C) {
    const r = opcode >> 3;
    const val = (getRegisterVal(r) + 1) & 0xFF;
    setRegisterVal(r, val);
    // Flags: INR affects S, Z, P, AC (NOT Carry CY)
    flags.Z = val === 0 ? 1 : 0;
    flags.S = (val & 0x80) ? 1 : 0;
    flags.P = checkParity(val);
    instrLength = 1;
  }
  // 9. DCR R (0x05 + R<<3)
  else if ((opcode & 7) === 5 && opcode >= 0 && opcode <= 0x3D) {
    const r = opcode >> 3;
    const val = (getRegisterVal(r) - 1 + 256) & 0xFF;
    setRegisterVal(r, val);
    // Flags
    flags.Z = val === 0 ? 1 : 0;
    flags.S = (val & 0x80) ? 1 : 0;
    flags.P = checkParity(val);
    instrLength = 1;
  }
  // 10. INX rp (0x03 + rp<<4)
  else if ((opcode & 0xCF) === 3) {
    const rp = (opcode - 3) >> 4;
    const val16 = (getRegisterPairVal(rp) + 1) & 0xFFFF;
    setRegisterPairVal(rp, val16);
    instrLength = 1;
  }
  // 11. DCX rp (0x0B + rp<<4)
  else if ((opcode & 0xCF) === 0x0B) {
    const rp = (opcode - 0x0B) >> 4;
    const val16 = (getRegisterPairVal(rp) - 1 + 65536) & 0xFFFF;
    setRegisterPairVal(rp, val16);
    instrLength = 1;
  }
  // 12. DAD rp (0x09 + rp<<4)
  else if ((opcode & 0xCF) === 0x09) {
    const rp = (opcode - 0x09) >> 4;
    const hl = (registers.H << 8) | registers.L;
    const pair = getRegisterPairVal(rp);
    const sum = hl + pair;
    registers.H = (sum >> 8) & 0xFF;
    registers.L = sum & 0xFF;
    flags.CY = sum > 0xFFFF ? 1 : 0;
    instrLength = 1;
  }
  // 13. LDA Addr (0x3A)
  else if (opcode === 0x3A) {
    const addr = (op2 << 8) | op1;
    registers.A = memory[addr];
    instrLength = 3;
  }
  // 14. STA Addr (0x32)
  else if (opcode === 0x32) {
    const addr = (op2 << 8) | op1;
    memory[addr] = registers.A;
    instrLength = 3;
  }
  // 15. LHLD Addr (0x2A)
  else if (opcode === 0x2A) {
    const addr = (op2 << 8) | op1;
    registers.L = memory[addr];
    registers.H = memory[addr + 1];
    instrLength = 3;
  }
  // 16. SHLD Addr (0x22)
  else if (opcode === 0x22) {
    const addr = (op2 << 8) | op1;
    memory[addr] = registers.L;
    memory[addr + 1] = registers.H;
    instrLength = 3;
  }
  // 17. LDAX B / D (0x0A, 0x1A)
  else if (opcode === 0x0A || opcode === 0x1A) {
    const rp = opcode === 0x0A ? 0 : 1;
    const addr = getRegisterPairVal(rp);
    registers.A = memory[addr];
    instrLength = 1;
  }
  // 18. STAX B / D (0x02, 0x12)
  else if (opcode === 0x02 || opcode === 0x12) {
    const rp = opcode === 0x02 ? 0 : 1;
    const addr = getRegisterPairVal(rp);
    memory[addr] = registers.A;
    instrLength = 1;
  }
  // 19. CMA (0x2F)
  else if (opcode === 0x2F) {
    registers.A = (~registers.A) & 0xFF;
    instrLength = 1;
  }
  // 20. CMP R (0xB8 - 0xBF)
  else if (opcode >= 0xB8 && opcode <= 0xBF) {
    const r = opcode & 7;
    const val = getRegisterVal(r);
    compare8Bit(val);
    instrLength = 1;
  }
  // 21. CPI Data (0xFE)
  else if (opcode === 0xFE) {
    compare8Bit(op1);
    instrLength = 2;
  }
  // 22. JMP Addr (0xC3)
  else if (opcode === 0xC3) {
    PC = (op2 << 8) | op1;
    instrLength = 0; // jump directly sets PC
  }
  // 23. Jumps Conditional (JZ, JNZ, JC, JNC, JP, JM, JPE, JPO)
  else if (opcode === 0xCA || opcode === 0xC2 || opcode === 0xDA || opcode === 0xD2 || opcode === 0xF2 || opcode === 0xFA || opcode === 0xEA || opcode === 0xE2) {
    const target = (op2 << 8) | op1;
    let jump = false;
    if (opcode === 0xCA && flags.Z === 1) jump = true;       // JZ
    else if (opcode === 0xC2 && flags.Z === 0) jump = true;  // JNZ
    else if (opcode === 0xDA && flags.CY === 1) jump = true; // JC
    else if (opcode === 0xD2 && flags.CY === 0) jump = true; // JNC
    else if (opcode === 0xF2 && flags.S === 0) jump = true;  // JP
    else if (opcode === 0xFA && flags.S === 1) jump = true;  // JM
    else if (opcode === 0xEA && flags.P === 1) jump = true;  // JPE
    else if (opcode === 0xE2 && flags.P === 0) jump = true;  // JPO

    if (jump) {
      PC = target;
      instrLength = 0;
    } else {
      instrLength = 3;
    }
  }
  // 24. Logical operations R (ANA, XRA, ORA)
  else if (opcode >= 0xA0 && opcode <= 0xB7) {
    const r = opcode & 7;
    const val = getRegisterVal(r);
    if (opcode >= 0xA0 && opcode <= 0xA7) and8Bit(val);      // ANA
    else if (opcode >= 0xA8 && opcode <= 0xAF) xor8Bit(val); // XRA
    else or8Bit(val);                                       // ORA
    instrLength = 1;
  }
  // 25. Logical immediate (ANI, XRI, ORI)
  else if (opcode === 0xE6 || opcode === 0xEE || opcode === 0xF6) {
    if (opcode === 0xE6) and8Bit(op1);      // ANI
    else if (opcode === 0xEE) xor8Bit(op1); // XRI
    else or8Bit(op1);                       // ORI
    instrLength = 2;
  }
  else {
    consoleLog.innerHTML += `<span style="color:var(--color-error)">Unknown opcode ${opcode.toString(16).toUpperCase()}H at ${PC.toString(16).toUpperCase()}H. Halting.</span>\n`;
    return false;
  }

  PC += instrLength;
  
  drawRegisters();
  
  // Highlight active editor lines
  highlightEditorLine(addressToLineMap[PC]);
  
  if (currentTab === "memory") {
    drawMemoryGrid();
  }

  return true;
}

// Subregisters logic helpers
function getRegisterVal(code) {
  if (code === 0) return registers.B;
  if (code === 1) return registers.C;
  if (code === 2) return registers.D;
  if (code === 3) return registers.E;
  if (code === 4) return registers.H;
  if (code === 5) return registers.L;
  if (code === 6) {
    // Memory M (address stored in HL)
    const hl = (registers.H << 8) | registers.L;
    return memory[hl];
  }
  return registers.A;
}

function setRegisterVal(code, val) {
  val &= 0xFF;
  if (code === 0) registers.B = val;
  else if (code === 1) registers.C = val;
  else if (code === 2) registers.D = val;
  else if (code === 3) registers.E = val;
  else if (code === 4) registers.H = val;
  else if (code === 5) registers.L = val;
  else if (code === 6) {
    const hl = (registers.H << 8) | registers.L;
    memory[hl] = val;
  }
  else registers.A = val;
}

function getRegisterPairVal(rp) {
  if (rp === 0) return (registers.B << 8) | registers.C;
  if (rp === 1) return (registers.D << 8) | registers.E;
  if (rp === 2) return (registers.H << 8) | registers.L;
  return SP;
}

function setRegisterPairVal(rp, val16) {
  val16 &= 0xFFFF;
  if (rp === 0) {
    registers.B = (val16 >> 8) & 0xFF;
    registers.C = val16 & 0xFF;
  } else if (rp === 1) {
    registers.D = (val16 >> 8) & 0xFF;
    registers.E = val16 & 0xFF;
  } else if (rp === 2) {
    registers.H = (val16 >> 8) & 0xFF;
    registers.L = val16 & 0xFF;
  } else {
    SP = val16;
  }
}

// Flags operations helpers
function checkParity(num) {
  let count = 0;
  for (let i = 0; i < 8; i++) {
    if ((num >> i) & 1) count++;
  }
  return count % 2 === 0 ? 1 : 0;
}

function add8Bit(val) {
  const sum = registers.A + val;
  flags.CY = sum > 0xFF ? 1 : 0;
  // Aux Carry: carry from bit 3 to 4
  flags.AC = ((registers.A & 0xF) + (val & 0xF)) > 0xF ? 1 : 0;
  
  registers.A = sum & 0xFF;
  flags.Z = registers.A === 0 ? 1 : 0;
  flags.S = (registers.A & 0x80) ? 1 : 0;
  flags.P = checkParity(registers.A);
}

function sub8Bit(val) {
  const diff = registers.A - val;
  flags.CY = diff < 0 ? 1 : 0;
  // Aux Carry: borrow check
  flags.AC = ((registers.A & 0xF) - (val & 0xF)) < 0 ? 0 : 1;
  
  registers.A = (diff + 256) & 0xFF;
  flags.Z = registers.A === 0 ? 1 : 0;
  flags.S = (registers.A & 0x80) ? 1 : 0;
  flags.P = checkParity(registers.A);
}

function compare8Bit(val) {
  const diff = registers.A - val;
  flags.Z = diff === 0 ? 1 : 0;
  flags.S = (diff & 0x80) ? 1 : 0;
  flags.CY = registers.A < val ? 1 : 0;
  flags.P = checkParity(diff & 0xFF);
}

function and8Bit(val) {
  registers.A = (registers.A & val) & 0xFF;
  flags.Z = registers.A === 0 ? 1 : 0;
  flags.S = (registers.A & 0x80) ? 1 : 0;
  flags.CY = 0;
  flags.AC = 1; // 8085 resets CY and sets AC to 1 for AND
  flags.P = checkParity(registers.A);
}

function xor8Bit(val) {
  registers.A = (registers.A ^ val) & 0xFF;
  flags.Z = registers.A === 0 ? 1 : 0;
  flags.S = (registers.A & 0x80) ? 1 : 0;
  flags.CY = 0;
  flags.AC = 0;
  flags.P = checkParity(registers.A);
}

function or8Bit(val) {
  registers.A = (registers.A | val) & 0xFF;
  flags.Z = registers.A === 0 ? 1 : 0;
  flags.S = (registers.A & 0x80) ? 1 : 0;
  flags.CY = 0;
  flags.AC = 0;
  flags.P = checkParity(registers.A);
}

/* ==========================================================================
   CPU Execution Controls
   ========================================================================== */
function runCode() {
  if (!isAssembled) return;

  const consoleLog = document.getElementById("consoleLog");
  consoleLog.innerHTML += "Executing program...\n";

  let stepCount = 0;
  
  // CPU Run Loop
  const runInterval = () => {
    const running = executeStep();
    stepCount++;
    
    if (running && stepCount < MAX_STEPS) {
      setTimeout(runInterval, 10);
    } else {
      if (stepCount >= MAX_STEPS) {
        consoleLog.innerHTML += `<span style="color:var(--color-error)">Execution Error: Infinite loop detected! Stopped after 10000 steps.</span>\n`;
      }
      disableRunStep();
      window.showToast("Program finished running!", "success");
    }
  };

  runInterval();
}

function stepCode() {
  if (!isAssembled) return;
  const running = executeStep();
  if (!running) {
    disableRunStep();
    window.showToast("Program finished!", "info");
  }
}

function disableRunStep() {
  document.getElementById("runCpuBtn").setAttribute("disabled", "true");
  document.getElementById("runCpuBtn").classList.add("disabled");
  document.getElementById("stepCpuBtn").setAttribute("disabled", "true");
  document.getElementById("stepCpuBtn").classList.add("disabled");
  
  // Unhighlight editor lines
  const lines = document.getElementById("editorLineNumbers").children;
  Array.from(lines).forEach(l => l.style.backgroundColor = "transparent");
}

function resetCpu() {
  registers = { A: 0, B: 0, C: 0, D: 0, E: 0, H: 0, L: 0 };
  PC = 0x2000;
  SP = 0xFFFF;
  flags = { S: 0, Z: 0, AC: 0, P: 0, CY: 0 };
  isAssembled = false;

  document.getElementById("consoleLog").innerHTML = "CPU Reset. Loaded memories persist.";
  
  document.getElementById("runCpuBtn").setAttribute("disabled", "true");
  document.getElementById("runCpuBtn").classList.add("disabled");
  document.getElementById("stepCpuBtn").setAttribute("disabled", "true");
  document.getElementById("stepCpuBtn").classList.add("disabled");

  const lines = document.getElementById("editorLineNumbers").children;
  Array.from(lines).forEach(l => l.style.backgroundColor = "transparent");

  drawRegisters();
  drawMemoryGrid();
  window.showToast("CPU registers and flags cleared", "info");
}

/* ==========================================================================
   UI Sync Updates (Registers & Memory Views)
   ========================================================================== */
function drawRegisters() {
  const toHex = (val) => val.toString(16).toUpperCase().padStart(2, "0") + "H";
  const toHex16 = (val) => val.toString(16).toUpperCase().padStart(4, "0") + "H";
  const toBin = (val) => val.toString(2).padStart(8, "0");

  document.getElementById("reg-val-a").innerText = toHex(registers.A);
  document.getElementById("reg-bin-a").innerText = toBin(registers.A);
  
  document.getElementById("reg-val-b").innerText = toHex(registers.B);
  document.getElementById("reg-bin-b").innerText = toBin(registers.B);

  document.getElementById("reg-val-c").innerText = toHex(registers.C);
  document.getElementById("reg-bin-c").innerText = toBin(registers.C);

  document.getElementById("reg-val-d").innerText = toHex(registers.D);
  document.getElementById("reg-bin-d").innerText = toBin(registers.D);

  document.getElementById("reg-val-e").innerText = toHex(registers.E);
  document.getElementById("reg-bin-e").innerText = toBin(registers.E);

  document.getElementById("reg-val-h").innerText = toHex(registers.H);
  document.getElementById("reg-bin-h").innerText = toBin(registers.H);

  document.getElementById("reg-val-l").innerText = toHex(registers.L);
  document.getElementById("reg-bin-l").innerText = toBin(registers.L);

  // M Pointer
  const hlVal = (registers.H << 8) | registers.L;
  const mVal = memory[hlVal];
  document.getElementById("reg-val-m").innerText = toHex(mVal);
  document.getElementById("reg-bin-m").innerText = `Address: ${toHex16(hlVal)}`;

  // Program Counter
  document.getElementById("reg-val-pc").innerText = toHex16(PC);
  document.getElementById("reg-val-sp").innerText = toHex16(SP);

  // Flags status lights
  const toggleFlagPill = (id, active) => {
    const bit = document.getElementById(id);
    const light = bit.querySelector(".flag-light");
    if (active) {
      bit.classList.add("active");
      light.innerText = "1";
    } else {
      bit.classList.remove("active");
      light.innerText = "0";
    }
  };

  toggleFlagPill("flag-s", flags.S);
  toggleFlagPill("flag-z", flags.Z);
  toggleFlagPill("flag-ac", flags.AC);
  toggleFlagPill("flag-p", flags.P);
  toggleFlagPill("flag-cy", flags.CY);
}

function drawMemoryGrid() {
  const tbody = document.getElementById("memoryTableBody");
  tbody.innerHTML = "";

  const baseAddrHex = document.getElementById("memLoadAddr").value.trim();
  let baseAddr = parseInt(baseAddrHex, 16);
  if (isNaN(baseAddr) || baseAddr < 0 || baseAddr > 0xFFFF) {
    baseAddr = 0x2000;
  }

  // Draw 64 rows of memory around the page load address
  for (let i = 0; i < 64; i++) {
    const addr = (baseAddr + i) & 0xFFFF;
    const addrStr = addr.toString(16).toUpperCase().padStart(4, "0");
    const val = memory[addr];
    const valHex = val.toString(16).toUpperCase().padStart(2, "0");

    const row = document.createElement("tr");
    row.id = `mem-row-${addrStr}`;
    
    // Highlight if active PC is pointing here
    if (isAssembled && PC === addr) {
      row.className = "mem-row-active";
    }

    // Detail assembly instruction if compiled there
    let detailText = "";
    if (compiledInstructions[addr]) {
      detailText = `<strong style="color:var(--accent-color)">${compiledInstructions[addr]}</strong>`;
    } else if (isProgramAddress(addr)) {
      detailText = `<span class="mem-row-opcode">Machine Operand byte</span>`;
    }

    row.innerHTML = `
      <td>${addrStr}H</td>
      <td>
        <input type="text" class="memory-cell-input" value="${valHex}" data-addr="${addr}" maxlength="2">
      </td>
      <td>${val}</td>
      <td>${detailText}</td>
    `;

    // Direct cell editing listener
    const cellInput = row.querySelector(".memory-cell-input");
    cellInput.addEventListener("change", (e) => {
      const targetAddr = parseInt(e.target.getAttribute("data-addr"));
      const hexVal = e.target.value.trim();
      const parsedVal = parseInt(hexVal, 16);

      if (!isNaN(parsedVal) && parsedVal >= 0 && parsedVal <= 255) {
        memory[targetAddr] = parsedVal;
        drawMemoryGrid();
        drawRegisters(); // in case M pointer or register values are affected
        window.showToast(`RAM cell ${targetAddr.toString(16).toUpperCase()}H updated to ${parsedVal.toString(16).toUpperCase()}H`, "info");
      } else {
        e.target.value = memory[targetAddr].toString(16).toUpperCase().padStart(2, "0");
        window.showToast("Invalid Hex Byte (00 - FF)", "error");
      }
    });

    tbody.appendChild(row);
  }
}

function isProgramAddress(addr) {
  // Check if this address is occupied as operand offset of compiled code lines
  for (let key in compiledInstructions) {
    const start = parseInt(key);
    const size = getInstructionSizeForOpcode(memory[start]);
    if (addr > start && addr < start + size) {
      return true;
    }
  }
  return false;
}

function getInstructionSizeForOpcode(opcode) {
  // Rough reverse mapping size for display column
  if (opcode === 0) return 1;
  // standard 8085 opcodes size check
  if ([0x32, 0x3A, 0xC3, 0xC2, 0xCA, 0xD2, 0xDA].includes(opcode)) return 3;
  if ([0x06, 0x0E, 0x16, 0x1E, 0x26, 0x2E, 0x36, 0x3E, 0xC6, 0xD6, 0xFE, 0xE6, 0xEE, 0xF6].includes(opcode)) return 2;
  return 1;
}

function highlightEditorLine(lineIdx) {
  const lineNumbers = document.getElementById("editorLineNumbers").children;
  Array.from(lineNumbers).forEach(l => l.style.backgroundColor = "transparent");
  
  if (lineIdx !== undefined && lineNumbers[lineIdx]) {
    lineNumbers[lineIdx].style.backgroundColor = "var(--accent-color-light)";
    lineNumbers[lineIdx].style.color = "var(--accent-color)";
    lineNumbers[lineIdx].style.fontWeight = "bold";
  }
}
