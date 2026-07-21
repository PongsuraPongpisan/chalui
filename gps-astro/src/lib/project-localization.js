const WORK_TYPE_LABELS = {
  "Road resurfacing": "ซ่อมผิวจราจร",
  Drainage: "ระบบระบายน้ำ",
  "Utility relocation": "ย้ายสาธารณูปโภค",
  "Bridge repair": "ซ่อมสะพาน",
  "Signal upgrade": "ปรับปรุงสัญญาณจราจร",
};

const ROAD_LABELS = {
  "Chaeng Watthana Road": "ถนนแจ้งวัฒนะ",
  "Vibhavadi Rangsit Road": "ถนนวิภาวดีรังสิต",
  "Ram Inthra Road": "ถนนรามอินทรา",
  "Phahonyothin Road": "ถนนพหลโยธิน",
  "Lat Phrao Road": "ถนนลาดพร้าว",
  "Srinagarindra Road": "ถนนศรีนครินทร์",
  "Ratchadaphisek Road": "ถนนรัชดาภิเษก",
  "Ngam Wong Wan Road": "ถนนงามวงศ์วาน",
  "Tiwanon Road": "ถนนติวานนท์",
  "Min Buri Road": "ถนนมีนบุรี",
  "Suwinthawong Road": "ถนนสุวินทวงศ์",
  "Bond Street Road": "ถนนบอนด์สตรีท",
};

export function localizeWorkType(value) {
  const text = String(value || "").trim();
  return WORK_TYPE_LABELS[text] || text || "-";
}

export function localizeRoad(value) {
  const text = String(value || "").trim();
  return ROAD_LABELS[text] || text || "-";
}

export { WORK_TYPE_LABELS, ROAD_LABELS };
