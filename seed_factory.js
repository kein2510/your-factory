const { createClient } = require('@supabase/supabase-js');

const url = 'https://ohgfaabrdgzuapyquqzh.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oZ2ZhYWJyZGd6dWFweXF1cXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNzkzNTAsImV4cCI6MjEwNjk1NTM1MH0.tn2kPL6poeb_r4JGTyclOmEbq-edEnfzNR-3_pAR9D0';
const supabase = createClient(url, key);

const initialItems = [
  // 素材
  {
    id: "ing-1",
    code: "MAT-01",
    name: "鉄くず・スクラップ",
    type: "ingredient",
    unit: "個",
    current_stock: 80,
    cost_price: 500,
    selling_price: 0,
    image_url: "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=400&h=300&fit=crop",
    recipe: [],
  },
  {
    id: "ing-2",
    code: "MAT-02",
    name: "スクラップメタル",
    type: "ingredient",
    unit: "個",
    current_stock: 50,
    cost_price: 1200,
    selling_price: 0,
    image_url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=300&fit=crop",
    recipe: [],
  },
  {
    id: "ing-3",
    code: "MAT-03",
    name: "電子基板・配線コード",
    type: "ingredient",
    unit: "個",
    current_stock: 35,
    cost_price: 3000,
    selling_price: 0,
    image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop",
    recipe: [],
  },
  {
    id: "ing-4",
    code: "MAT-04",
    name: "工業用ゴム・タイヤ素材",
    type: "ingredient",
    unit: "個",
    current_stock: 40,
    cost_price: 800,
    selling_price: 0,
    image_url: "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=400&h=300&fit=crop",
    recipe: [],
  },
  {
    id: "ing-5",
    code: "MAT-05",
    name: "高性能エンジンオイル缶",
    type: "ingredient",
    unit: "缶",
    current_stock: 30,
    cost_price: 1500,
    selling_price: 0,
    image_url: "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400&h=300&fit=crop",
    recipe: [],
  },
  // 車両整備・修理メニュー
  {
    id: "prd-1",
    code: "SRV-01",
    name: "フル修理・板金塗装",
    type: "product",
    shop_id: "factory",
    category_id: "cat-repair",
    category_name: "車両整備・修理",
    unit: "回",
    current_stock: 99,
    selling_price: 50000,
    cost_price: 5000,
    image_url: "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400&h=300&fit=crop",
    recipe: [
      { ingredient_id: "ing-1", ingredient_name: "鉄くず・スクラップ", quantity: 2 },
      { ingredient_id: "ing-2", ingredient_name: "スクラップメタル", quantity: 1 },
    ],
  },
  {
    id: "prd-2",
    code: "SRV-02",
    name: "クイック修理・応急処置",
    type: "product",
    shop_id: "factory",
    category_id: "cat-repair",
    category_name: "車両整備・修理",
    unit: "回",
    current_stock: 99,
    selling_price: 20000,
    cost_price: 2000,
    image_url: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=400&h=300&fit=crop",
    recipe: [
      { ingredient_id: "ing-1", ingredient_name: "鉄くず・スクラップ", quantity: 1 },
    ],
  },
  {
    id: "prd-3",
    code: "SRV-03",
    name: "タイヤ交換・バランス調整",
    type: "product",
    shop_id: "factory",
    category_id: "cat-repair",
    category_name: "車両整備・修理",
    unit: "回",
    current_stock: 99,
    selling_price: 15000,
    cost_price: 1600,
    image_url: "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=400&h=300&fit=crop",
    recipe: [
      { ingredient_id: "ing-4", ingredient_name: "工業用ゴム・タイヤ素材", quantity: 2 },
    ],
  },
  // カスタムパーツ
  {
    id: "prd-4",
    code: "CST-01",
    name: "エンジンチューニングキット",
    type: "product",
    shop_id: "factory",
    category_id: "cat-custom",
    category_name: "カスタムパーツ",
    unit: "個",
    current_stock: 8,
    selling_price: 80000,
    cost_price: 12000,
    image_url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&h=300&fit=crop",
    recipe: [
      { ingredient_id: "ing-2", ingredient_name: "スクラップメタル", quantity: 4 },
      { ingredient_id: "ing-3", ingredient_name: "電子基板・配線コード", quantity: 2 },
      { ingredient_id: "ing-5", ingredient_name: "高性能エンジンオイル缶", quantity: 1 },
    ],
  },
  {
    id: "prd-5",
    code: "CST-02",
    name: "NOS ニトロブーストキット",
    type: "product",
    shop_id: "factory",
    category_id: "cat-custom",
    category_name: "カスタムパーツ",
    unit: "個",
    current_stock: 5,
    selling_price: 120000,
    cost_price: 18000,
    image_url: "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=400&h=300&fit=crop",
    recipe: [
      { ingredient_id: "ing-2", ingredient_name: "スクラップメタル", quantity: 6 },
      { ingredient_id: "ing-3", ingredient_name: "電子基板・配線コード", quantity: 3 },
    ],
  },
  // リペアキット
  {
    id: "prd-6",
    code: "KIT-01",
    name: "標準リペアキット",
    type: "product",
    shop_id: "factory",
    category_id: "cat-kit",
    category_name: "リペアキット・消耗品",
    unit: "個",
    current_stock: 20,
    selling_price: 10000,
    cost_price: 2200,
    image_url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&h=300&fit=crop",
    recipe: [
      { ingredient_id: "ing-1", ingredient_name: "鉄くず・スクラップ", quantity: 3 },
      { ingredient_id: "ing-2", ingredient_name: "スクラップメタル", quantity: 1 },
    ],
  },
  {
    id: "prd-7",
    code: "KIT-02",
    name: "アドバンスドリペアキット",
    type: "product",
    shop_id: "factory",
    category_id: "cat-kit",
    category_name: "リペアキット・消耗品",
    unit: "個",
    current_stock: 12,
    selling_price: 25000,
    cost_price: 5400,
    image_url: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=400&h=300&fit=crop",
    recipe: [
      { ingredient_id: "ing-1", ingredient_name: "鉄くず・スクラップ", quantity: 5 },
      { ingredient_id: "ing-2", ingredient_name: "スクラップメタル", quantity: 2 },
      { ingredient_id: "ing-3", ingredient_name: "電子基板・配線コード", quantity: 1 },
    ],
  },
  {
    id: "prd-8",
    code: "KIT-03",
    name: "洗車・撥水コーティング",
    type: "product",
    shop_id: "factory",
    category_id: "cat-kit",
    category_name: "リペアキット・消耗品",
    unit: "回",
    current_stock: 99,
    selling_price: 5000,
    cost_price: 500,
    image_url: "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=400&h=300&fit=crop",
    recipe: [],
  },
];

const mockStaffUsers = [
  {
    id: "user-kein",
    username: "kein",
    pass: "001",
    displayName: "kein (工場長)",
    role: "executive",
    roleName: "工場長 (代表)",
    bonusAmount: 50000,
    bonusNote: "工場立ち上げ・全体統括",
    created_at: new Date().toISOString(),
  },
  {
    id: "user-suzuki",
    username: "suzuki",
    pass: "123",
    displayName: "鈴木 (チーフメカニック)",
    role: "executive",
    roleName: "チーフメカニック / 幹部",
    bonusAmount: 40000,
    bonusNote: "カスタム施工・車両チューニング統括",
    created_at: new Date().toISOString(),
  },
  {
    id: "user-yamada",
    username: "yamada",
    pass: "123",
    displayName: "山田 (一般整備士)",
    role: "staff",
    roleName: "一般整備士",
    bonusAmount: 25000,
    bonusNote: "リペア作業・接客実績良好",
    created_at: new Date().toISOString(),
  },
  {
    id: "user-sato",
    username: "sato",
    pass: "123",
    displayName: "佐藤 (見習いメカニック)",
    role: "staff",
    roleName: "見習いメカニック",
    bonusAmount: 20000,
    bonusNote: "スクラップ素材調達・パーツ仕込み担当",
    created_at: new Date().toISOString(),
  },
];

const defaultCustomRoles = [
  { id: "role-owner", name: "工場長 (代表)", color: "amber", isExecutive: true, baseAllowance: 50000, description: "Your Factory 最高責任者・全権限（kein）" },
  { id: "role-chief", name: "チーフメカニック / 幹部", color: "rose", isExecutive: true, baseAllowance: 40000, description: "車両カスタム・工場運営・ボーナス査定" },
  { id: "role-senior", name: "主任整備士", color: "emerald", isExecutive: false, baseAllowance: 30000, description: "整備施工・パーツクラフト責任者" },
  { id: "role-mechanic", name: "一般整備士", color: "blue", isExecutive: false, baseAllowance: 15000, description: "車両修理・カスタム施工・レジ販売", isDefault: true },
  { id: "role-apprentice", name: "見習いメカニック", color: "stone", isExecutive: false, baseAllowance: 10000, description: "スクラップ素材調達・作業補助" },
];

const defaultCategories = [
  { id: "cat-repair", name: "車両整備・修理", order: 1, color: "blue", icon: "🔧", targetType: "product" },
  { id: "cat-custom", name: "カスタムパーツ", order: 2, color: "amber", icon: "🏎️", targetType: "product" },
  { id: "cat-kit", name: "リペアキット・消耗品", order: 3, color: "emerald", icon: "🧰", targetType: "product" },
  { id: "cat-ingredient", name: "素材・スクラップ", order: 4, color: "stone", icon: "⚙️", targetType: "ingredient" },
];

const defaultShops = [
  {
    id: "factory",
    name: "Your Factory",
    shortName: "Your Factory",
    icon: "🔧",
    themeColor: "amber",
    description: "車両修理・カスタム・パーツ加工・整備",
  },
];

async function seed() {
  console.log("Seeding items...");
  const { error: itemsErr } = await supabase.from("factory_items").upsert(initialItems);
  if (itemsErr) console.error("items error:", itemsErr);
  else console.log(`✓ Inserted ${initialItems.length} items`);

  console.log("Seeding system state...");
  await supabase.from("factory_system_state").upsert([
    { key: "users", value: mockStaffUsers },
    { key: "roles", value: defaultCustomRoles },
    { key: "categories", value: defaultCategories },
    { key: "shops", value: defaultShops },
    { key: "site_branding", value: { siteName: "Your Factory", siteSubtitle: "メカニック・車両整備・パーツクラフト管理システム", logoUrl: "/logo.png", themeColor: "amber" } },
    { key: "store_settings", value: { enableCrafting: true, enableInventory: true, storeRemainingRate: 70, storeRemainingBonusRate: 0, craftRewardRate: 0, ingredientRewardRate: 0 } },
    { key: "vault_balance", value: 100000 },
  ]);
  console.log("✓ System state seeded!");
}

seed();
