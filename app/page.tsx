"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ShoppingBag,
  Hammer,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Boxes,
  Plus,
  Minus,
  Store,
  Radio,
  Undo2,
  Tag,
  Percent,
  Users,
  Wrench,
  UserPlus,
  Trash2,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { formatCurrency } from "@/lib/utils";
import { ShopId, MultiStaffAssignment } from "@/types";
import { supabase } from "@/lib/supabase";

interface StaffAssignmentInput {
  userId: string;
  staffName: string;
  workCount: number; // 担当箇所数
}

export default function MainPage() {
  const {
    items,
    products,
    ingredients,
    sellProducts,
    craftProducts,
    refreshData,
    rollbackCraftItems,
    storeSettings,
    shops,
    siteBranding,
    categories,
    currentUser,
    users,
  } = useApp();

  // 現在選択中の店舗
  const [selectedShopId, setSelectedShopId] = useState<string>("factory");
  const [prevShops, setPrevShops] = useState(shops);

  // 有効な店舗が存在する場合、未選択または削除済みの店舗なら先頭の店舗を選択
  if (shops !== prevShops) {
    setPrevShops(shops);
    if (shops.length > 0 && !shops.some((s) => s.id === selectedShopId)) {
      setSelectedShopId(shops[0].id);
    }
  }

  // 各商品の選択個数ステート { [itemId]: number }
  const [quantities, setQuantities] = useState<{ [itemId: string]: number }>({});
  // 調整値引きステート
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>("");
  const [showDiscountForm, setShowDiscountForm] = useState<boolean>(false);

  // 現在の店舗情報と分担モード判定
  const currentShopInfo = shops.find((s) => s.id === selectedShopId) || shops[0] || {
    id: "factory",
    name: "Your Factory",
    shortName: "Your Factory",
    icon: "🔧",
    themeColor: "amber",
  };
  const isMultiStaffShop = Boolean(currentShopInfo.enableMultiStaffWork);

  // 👥 複数人共同作業（出張修理など）ステート
  const [totalWorkCount, setTotalWorkCount] = useState<number>(1);
  const [workLocations, setWorkLocations] = useState<string>("");
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignmentInput[]>([]);
  const [sharedDraftNotice, setSharedDraftNotice] = useState<string | null>(null);

  // ログインユーザーが変わった時、または初期化時に自身をデフォルト設定
  useEffect(() => {
    if (currentUser && staffAssignments.length === 0) {
      setStaffAssignments([
        { userId: currentUser.id, staffName: currentUser.displayName, workCount: 1 },
      ]);
    }
  }, [currentUser, staffAssignments.length]);

  // 個人ごとの入力下書きキー (通常店舗用)
  const draftStorageKey = useMemo(() => {
    return currentUser ? `your_factory_pos_draft_${currentUser.id}` : "your_factory_pos_draft_guest";
  }, [currentUser]);

  // クラウド同期キー (分担設定店舗用: 全スタッフ共通)
  const cloudDraftKey = `shared_multistaff_draft_${selectedShopId}`;

  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  // ① 店舗変更時またはマウント時: 分担店舗ならクラウドから、通常店舗ならlocalStorageから復元
  useEffect(() => {
    let isCancelled = false;

    if (isMultiStaffShop && supabase) {
      // クラウドから共有出張修理データを取得
      supabase
        .from("factory_system_state")
        .select("value, updated_at")
        .eq("key", cloudDraftKey)
        .maybeSingle()
        .then(({ data, error }) => {
          if (isCancelled) return;
          if (!error && data?.value) {
            const val = data.value as {
              quantities?: { [itemId: string]: number };
              totalWorkCount?: number;
              workLocations?: string;
              staffAssignments?: StaffAssignmentInput[];
              discountAmount?: number;
              discountReason?: string;
              updatedBy?: string;
            };
            if (val.quantities && typeof val.quantities === "object") {
              setQuantities(val.quantities);
            } else {
              setQuantities({});
            }
            if (typeof val.totalWorkCount === "number") {
              setTotalWorkCount(val.totalWorkCount);
            }
            if (typeof val.workLocations === "string") {
              setWorkLocations(val.workLocations);
            }
            if (Array.isArray(val.staffAssignments) && val.staffAssignments.length > 0) {
              setStaffAssignments(val.staffAssignments);
            } else if (currentUser) {
              setStaffAssignments([{ userId: currentUser.id, staffName: currentUser.displayName, workCount: 1 }]);
            }
            if (typeof val.discountAmount === "number") {
              setDiscountAmount(val.discountAmount);
              if (val.discountAmount > 0) setShowDiscountForm(true);
            }
            if (typeof val.discountReason === "string") {
              setDiscountReason(val.discountReason);
            }
            if (val.updatedBy) {
              setSharedDraftNotice(`👥「${currentShopInfo.name}」の分担伝票をクラウドから同期しました (最終更新: ${val.updatedBy})`);
              setTimeout(() => setSharedDraftNotice(null), 4000);
            }
          }
          setIsDraftLoaded(true);
        });
    } else {
      // 通常店舗: localStorageから復元
      try {
        const saved = localStorage.getItem(draftStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.quantities && typeof parsed.quantities === "object") {
            setQuantities(parsed.quantities);
          }
          if (typeof parsed.discountAmount === "number") {
            setDiscountAmount(parsed.discountAmount);
            if (parsed.discountAmount > 0) setShowDiscountForm(true);
          }
          if (typeof parsed.discountReason === "string") {
            setDiscountReason(parsed.discountReason);
          }
        }
      } catch (e) {
        console.error("Failed to restore draft:", e);
      } finally {
        setIsDraftLoaded(true);
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [selectedShopId, isMultiStaffShop, cloudDraftKey, draftStorageKey, currentUser, currentShopInfo.name]);

  // ② 入力内容の自動保存: 分担店舗ならクラウドに即座・定期同期、通常店舗ならlocalStorageに保存
  useEffect(() => {
    if (!isDraftLoaded) return;

    if (isMultiStaffShop) {
      if (!supabase) return;
      const timer = setTimeout(async () => {
        try {
          const payload = {
            shopId: selectedShopId,
            quantities,
            totalWorkCount,
            workLocations,
            staffAssignments,
            discountAmount,
            discountReason,
            updatedBy: currentUser?.displayName || "メカニック",
            updatedAt: new Date().toISOString(),
          };
          await supabase.from("factory_system_state").upsert({
            key: cloudDraftKey,
            value: payload,
            updated_at: new Date().toISOString(),
          });
        } catch (e) {
          console.error("Failed to sync multi-staff draft to cloud:", e);
        }
      }, 700);
      return () => clearTimeout(timer);
    } else {
      // 通常店舗
      try {
        const draft = {
          selectedShopId,
          quantities,
          discountAmount,
          discountReason,
        };
        localStorage.setItem(draftStorageKey, JSON.stringify(draft));
      } catch (e) {
        console.error("Failed to save local draft:", e);
      }
    }
  }, [
    isDraftLoaded,
    isMultiStaffShop,
    cloudDraftKey,
    draftStorageKey,
    selectedShopId,
    quantities,
    totalWorkCount,
    workLocations,
    staffAssignments,
    discountAmount,
    discountReason,
    currentUser,
  ]);

  // ドラフトのクリア関数
  const clearDraft = () => {
    setQuantities({});
    setDiscountAmount(0);
    setDiscountReason("");
    setShowDiscountForm(false);
    setTotalWorkCount(1);
    setWorkLocations("");
    if (currentUser) {
      setStaffAssignments([
        { userId: currentUser.id, staffName: currentUser.displayName, workCount: 1 },
      ]);
    } else {
      setStaffAssignments([]);
    }

    // 分担店舗の場合はクラウド上も空にする
    if (isMultiStaffShop && supabase) {
      supabase.from("factory_system_state").upsert({
        key: cloudDraftKey,
        value: null,
        updated_at: new Date().toISOString(),
      }).then(() => {});
    }

    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
      // ignore
    }
  };

  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);

  // 直前のクラフト情報（取り消し用）
  const [lastCraft, setLastCraft] = useState<{
    quantities: Record<string, number>;
    shopId: ShopId;
    names: string[];
  } | null>(null);

  // メイン画面の Supabase Realtime サブスクリプション
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("main_page_realtime_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "factory_items" },
        (payload) => {
          refreshData();
          if (payload.eventType === "UPDATE") {
            const newItem = payload.new as { name?: string; current_stock?: number; unit?: string };
            setRealtimeNotice(`【在庫更新】「${newItem.name || ""}」が同期されました (現在庫: ${newItem.current_stock ?? 0}${newItem.unit || ""})`);
          } else if (payload.eventType === "INSERT") {
            setRealtimeNotice("【パーツ・商品追加】新しいアイテムが同期されました！");
          }
          setTimeout(() => setRealtimeNotice(null), 3500);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "factory_sales" },
        (payload) => {
          refreshData();
          if (payload.eventType === "INSERT") {
            const s = payload.new as { staff_name?: string; total_amount?: number };
            setRealtimeNotice(`【売上登録】${s.staff_name || "整備士"}が売上 ¥${Number(s.total_amount ?? 0).toLocaleString()} を登録しました！`);
          }
          setTimeout(() => setRealtimeNotice(null), 3500);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "factory_system_state" },
        (payload) => {
          const row = payload.new as { key?: string; value?: unknown };
          if (row?.key === cloudDraftKey && isMultiStaffShop) {
            const val = row.value as {
              quantities?: { [itemId: string]: number };
              totalWorkCount?: number;
              workLocations?: string;
              staffAssignments?: StaffAssignmentInput[];
              discountAmount?: number;
              discountReason?: string;
              updatedBy?: string;
            } | null;
            if (val) {
              if (val.quantities) setQuantities(val.quantities);
              if (typeof val.totalWorkCount === "number") setTotalWorkCount(val.totalWorkCount);
              if (typeof val.workLocations === "string") setWorkLocations(val.workLocations);
              if (Array.isArray(val.staffAssignments)) setStaffAssignments(val.staffAssignments);
              if (typeof val.discountAmount === "number") setDiscountAmount(val.discountAmount);
              if (typeof val.discountReason === "string") setDiscountReason(val.discountReason);
              if (val.updatedBy && val.updatedBy !== currentUser?.displayName) {
                setSharedDraftNotice(`👥「${val.updatedBy}」が分担伝票をリアルタイム更新しました`);
                setTimeout(() => setSharedDraftNotice(null), 3500);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshData]);

  // カテゴリーの表示順マップ
  const categoryOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach((c) => {
      map.set(c.name, c.order);
    });
    return map;
  }, [categories]);

  // 選択中店舗の料理商品のみを抽出し、カテゴリーの order 順（#1, #2...）にソート
  const currentShopProducts = useMemo(() => {
    const shopProducts = products.filter(
      (p) => (p.shopId || "factory") === selectedShopId
    );

    return [...shopProducts].sort((a, b) => {
      const orderA = categoryOrderMap.get(a.category_name || "") ?? 9999;
      const orderB = categoryOrderMap.get(b.category_name || "") ?? 9999;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return (a.category_name || "").localeCompare(b.category_name || "") || a.name.localeCompare(b.name);
    });
  }, [products, selectedShopId, categoryOrderMap]);

  // カテゴリー選択（タブフィルター）
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // 現在の店舗で実際に使われているカテゴリー一覧 (order 順)
  const currentShopCategories = useMemo(() => {
    const usedCatNames = new Set(
      currentShopProducts.map((p) => p.category_name || "未分類")
    );
    const matched = categories.filter((c) => usedCatNames.has(c.name));
    const extraNames = Array.from(usedCatNames).filter(
      (name) => !categories.some((c) => c.name === name)
    );
    return [
      ...matched,
      ...extraNames.map((name, idx) => ({
        id: `extra-cat-${idx}`,
        name,
        order: 9990 + idx,
        icon: "📁",
      })),
    ].sort((a, b) => a.order - b.order);
  }, [currentShopProducts, categories]);

  // 画面に表示する商品（カテゴリーフィルター適用）
  const displayedProducts = useMemo(() => {
    if (selectedCategory === "all") return currentShopProducts;
    return currentShopProducts.filter(
      (p) => (p.category_name || "未分類") === selectedCategory
    );
  }, [currentShopProducts, selectedCategory]);

  // 個数更新
  const handleSetQuantity = (itemId: string, qty: number) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: Math.max(0, qty),
    }));
  };

  // 画像2枚目のクイック加算ボタン [0], [1], [10], [100]
  const handleQuickAdd = (itemId: string, addAmount: number) => {
    if (addAmount === 0) {
      handleSetQuantity(itemId, 0);
    } else {
      const current = quantities[itemId] || 0;
      handleSetQuantity(itemId, current + addAmount);
    }
  };

  // 全リセット
  const handleResetAll = () => {
    clearDraft();
    setNotification(null);
  };

  // 店舗切り替え
  const handleSwitchShop = (shopId: string) => {
    if (selectedShopId !== shopId) {
      setSelectedShopId(shopId);
      setQuantities({}); // 店舗が変わったら選択個数はリセット
      setDiscountAmount(0);
      setDiscountReason("");
      setShowDiscountForm(false);
      setNotification(null);
    }
  };

  // 小計金額の計算 (選択中店舗の 数量 × 単価)
  const subtotal = currentShopProducts.reduce((sum, item) => {
    const qty = quantities[item.id] || 0;
    return sum + item.selling_price * qty;
  }, 0);

  // 調整値引きを反映した最終お会計金額
  const validDiscount = Math.max(0, Math.min(subtotal, Math.round(Number(discountAmount) || 0)));
  const finalTotalAmount = Math.max(0, subtotal - validDiscount);

  // 合計個数の計算
  const totalItemsCount = Object.values(quantities).reduce((sum, q) => sum + q, 0);

  // 選択中の商品詳細リスト（カート明細・左側表示用）
  const selectedItemsList = useMemo(() => {
    return Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => {
        const item = items.find((i) => i.id === id);
        return {
          id,
          item,
          quantity: q,
          subtotal: (item?.selling_price || 0) * q,
        };
      })
      .filter((entry): entry is { id: string; item: (typeof items)[0]; quantity: number; subtotal: number } => Boolean(entry.item));
  }, [quantities, items]);

  // 「売る」実行
  const handleSell = () => {
    if (totalItemsCount === 0) {
      setNotification({ type: "error", message: "販売する商品の個数を指定してください。" });
      return;
    }

    // 複数人共同作業（出張修理）データの構築
    let multiStaffData: MultiStaffAssignment | undefined = undefined;
    if (isMultiStaffShop && staffAssignments.length > 0) {
      const sumShares = staffAssignments.reduce((acc, s) => acc + s.workCount, 0);
      const totalCount = Math.max(1, totalWorkCount || sumShares || 1);

      let allocatedTotal = 0;
      const shares = staffAssignments.map((s, idx) => {
        const rate = sumShares > 0 ? (s.workCount / sumShares) : (1 / staffAssignments.length);
        let alloc = Math.round(finalTotalAmount * rate);
        if (idx === staffAssignments.length - 1) {
          // 最終行で端数調整を行い、合計金額と完全に一致させる
          alloc = finalTotalAmount - allocatedTotal;
        } else {
          allocatedTotal += alloc;
        }
        return {
          userId: s.userId,
          staffName: s.staffName,
          workCount: s.workCount,
          shareRate: rate,
          allocatedAmount: Math.max(0, alloc),
        };
      });

      multiStaffData = {
        enabled: true,
        totalWorkCount: totalCount,
        workLocations: workLocations.trim() || undefined,
        staffShares: shares,
      };
    }

    const result = sellProducts(quantities, selectedShopId, validDiscount, discountReason, multiStaffData);
    if (result.success) {
      setNotification({ type: "success", message: result.message });
      clearDraft();
    } else {
      setNotification({ type: "error", message: result.message });
    }
  };

  // 「作成 (在庫を増やす)」実行
  const handleCraft = () => {
    if (totalItemsCount === 0) {
      setNotification({ type: "error", message: "作成する商品の個数を指定してください。" });
      return;
    }

    const currentQuantities = { ...quantities };
    const currentShop = selectedShopId;
    const craftedNames = Object.entries(currentQuantities)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => {
        const it = items.find((i) => i.id === id);
        return `${it?.name || "商品"} ×${q}`;
      });

    const result = craftProducts(currentQuantities, currentShop);
    if (result.success) {
      setLastCraft({
        quantities: currentQuantities,
        shopId: currentShop,
        names: craftedNames,
      });
      setNotification({ type: "success", message: result.message });
      setQuantities({});
    } else {
      setNotification({ type: "error", message: result.message });
    }
  };

  // 直前のクラフト作成を取り消す（在庫減算 ＆ 素材在庫復元）
  const handleRollbackLastCraft = () => {
    if (!lastCraft) return;
    if (
      window.confirm(
        `直前に作成した処理を取り消しますか？\n\n【取り消し対象】\n${lastCraft.names.join("、")}\n\n・完成商品の在庫を減算します\n・消費された素材在庫を元通り復元します`
      )
    ) {
      const result = rollbackCraftItems(lastCraft.quantities, lastCraft.shopId);
      if (result.success) {
        setNotification({ type: "success", message: result.message });
        setLastCraft(null);
      } else {
        setNotification({ type: "error", message: result.message });
      }
    }
  };

  // ==========================================
  // UI パーツ・レンダリングヘルパー群
  // ==========================================

  // ① 店舗切り替えセレクター
  const renderShopSelector = (isWide: boolean) => (
    <div className={`bg-stone-900 border border-stone-800 p-4 rounded-2xl shadow-xl space-y-3 ${isWide ? "w-full" : ""}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800/80 pb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black text-stone-400 flex items-center gap-1.5">
            <Store className="w-4 h-4 text-amber-500" />
            店舗切り替え:
          </span>
          <div className="inline-flex p-1 rounded-2xl bg-stone-900 border border-stone-800 flex-wrap gap-1">
            {shops.map((shop) => {
              const isSelected = selectedShopId === shop.id;
              const c = shop.themeColor || shop.color;
              const activeColorClass =
                c === "emerald"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/50 scale-[1.02]"
                  : c === "amber"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-950/50 scale-[1.02]"
                  : c === "blue"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-950/50 scale-[1.02]"
                  : c === "purple"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-950/50 scale-[1.02]"
                  : c === "stone"
                  ? "bg-stone-700 text-white shadow-md shadow-stone-950/50 scale-[1.02]"
                  : "bg-rose-600 text-white shadow-md shadow-rose-950/50 scale-[1.02]";

              return (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => handleSwitchShop(shop.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? activeColorClass
                      : "text-stone-400 hover:text-white hover:bg-stone-800/60"
                  }`}
                >
                  <span>{shop.icon}</span>
                  <span>{shop.name}</span>
                  {shop.enableMultiStaffWork && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-stone-950/60 text-indigo-300 border border-indigo-500/30">
                      分担
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {storeSettings.sharedInventoryAcrossShops && (
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-500/50 shadow-xs flex items-center gap-1">
              <span>🔗</span>
              <span>全店共通在庫モード</span>
            </span>
          )}
          <span className="text-[11px] font-bold text-stone-400">
            現在: <strong className="text-amber-400 font-black">{currentShopInfo.name}</strong>{" "}
            ({currentShopProducts.length}商品)
          </span>
        </div>
      </div>
    </div>
  );

  // ② 選択中商品（カート）明細
  const renderCartItemsList = (isWide: boolean) => {
    if (selectedItemsList.length === 0) return null;

    return (
      <div className="bg-stone-950/80 rounded-xl border border-stone-800 p-3 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-stone-300 border-b border-stone-800/80 pb-2">
          <span className="flex items-center gap-1.5 text-stone-200">
            <ShoppingBag className="w-4 h-4 text-rose-400" />
            選択中商品 / 使用パーツ ({selectedItemsList.length}品目・計{totalItemsCount}点)
          </span>
          <span className="text-xs text-amber-300 font-mono font-black">
            小計: {formatCurrency(subtotal)}
          </span>
        </div>

        <div className={`space-y-2 ${isWide ? "grid grid-cols-1 md:grid-cols-2 gap-2 space-y-0" : "max-h-60 overflow-y-auto pr-1 custom-scrollbar"}`}>
          {selectedItemsList.map(({ id, item, quantity, subtotal: itemSub }) => (
            <div
              key={id}
              className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-stone-900 border border-stone-800 hover:border-stone-700 transition-all text-xs"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-8 h-8 rounded-lg object-cover border border-stone-700 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700 flex items-center justify-center text-xs shrink-0 text-stone-500">
                    📦
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="font-extrabold text-white text-xs truncate">
                    {item.name}
                  </h4>
                  <span className="text-[10px] text-rose-300 font-bold block">
                    {formatCurrency(item.selling_price)} / {item.unit}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex items-center bg-stone-950 rounded-lg border border-stone-700 p-0.5">
                  <button
                    type="button"
                    onClick={() => handleSetQuantity(id, quantity - 1)}
                    className="w-5 h-5 flex items-center justify-center text-stone-400 hover:text-white rounded hover:bg-stone-800"
                    title="-1"
                  >
                    <Minus className="w-2.5 h-2.5" />
                  </button>
                  <span className="w-8 text-center font-black text-white text-xs">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSetQuantity(id, quantity + 1)}
                    className="w-5 h-5 flex items-center justify-center text-stone-400 hover:text-white rounded hover:bg-stone-800"
                    title="+1"
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                </div>

                <span className="text-xs font-black text-amber-300 font-mono min-w-[50px] text-right">
                  {formatCurrency(itemSub)}
                </span>

                <button
                  type="button"
                  onClick={() => handleSetQuantity(id, 0)}
                  className="text-stone-500 hover:text-rose-400 p-1 rounded hover:bg-stone-800"
                  title="選択解除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ③ 調整値引きパネル
  const renderDiscountPanel = () => (
    <div className="pt-3 border-t border-stone-800 bg-stone-950/85 p-3.5 rounded-2xl border border-stone-800 space-y-3 animate-in fade-in duration-150">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-amber-400 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" />
              値引き額:
            </span>
            <div className="flex items-center gap-1 bg-stone-900 px-3 py-1.5 rounded-xl border border-stone-700">
              <span className="text-xs text-stone-400 font-bold">-¥</span>
              <input
                type="number"
                min="0"
                max={subtotal}
                value={discountAmount === 0 ? "" : discountAmount}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(subtotal, parseInt(e.target.value) || 0));
                  setDiscountAmount(val);
                }}
                placeholder="0"
                className="w-28 bg-transparent text-amber-300 font-black text-base focus:outline-none"
              />
              <span className="text-xs text-stone-500 font-bold">円</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-stone-400 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-amber-500" />
              割合:
            </span>
            <div className="flex items-center gap-1 bg-stone-900 px-2.5 py-1.5 rounded-xl border border-stone-700">
              <input
                type="number"
                min="0"
                max="100"
                value={subtotal > 0 && discountAmount > 0 ? Math.round((discountAmount / subtotal) * 100) : ""}
                onChange={(e) => {
                  const pct = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                  const amt = Math.round(subtotal * (pct / 100));
                  setDiscountAmount(amt);
                  if (pct > 0) setDiscountReason(`${pct}% OFF`);
                }}
                placeholder="0"
                className="w-12 bg-transparent text-amber-300 font-black text-sm text-center focus:outline-none"
              />
              <span className="text-xs text-stone-400 font-bold">% OFF</span>
            </div>
          </div>

          {discountAmount > 0 && (
            <button
              type="button"
              onClick={() => { setDiscountAmount(0); setDiscountReason(""); }}
              className="px-2.5 py-1.5 text-xs font-black bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-xl border border-rose-800 transition-all cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <RotateCcw className="w-3 h-3" />
              値引き取消 (0円)
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowDiscountForm(false)}
          className="text-xs text-stone-400 hover:text-stone-200 self-end md:self-auto cursor-pointer font-medium"
        >
          ✕ パネルを閉じる
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-stone-800/60">
        <span className="text-[11px] font-black text-stone-400 flex items-center gap-1 shrink-0">
          <Percent className="w-3 h-3 text-amber-500" />
          ％値引き:
        </span>
        {[5, 10, 15, 20, 30, 50].map((pct) => {
          const amt = Math.round(subtotal * (pct / 100));
          const isCurrentPct = subtotal > 0 && discountAmount === amt;
          return (
            <button
              type="button"
              key={pct}
              onClick={() => {
                setDiscountAmount(amt);
                setDiscountReason(`${pct}% OFF`);
              }}
              className={`px-2.5 py-1 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                isCurrentPct
                  ? "bg-amber-500 text-stone-950 border-amber-400 shadow-md scale-105"
                  : "bg-stone-900 hover:bg-stone-800 text-amber-300 border-stone-700 hover:border-amber-500/50"
              }`}
            >
              {pct}% OFF <span className="text-[10px] font-normal text-stone-400">(-¥{amt.toLocaleString()})</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-stone-800/60">
        <span className="text-[11px] font-black text-stone-400 flex items-center gap-1 shrink-0">
          <Plus className="w-3 h-3 text-emerald-400" />
          金額加算:
        </span>
        {subtotal % 1000 > 0 && (
          <button
            type="button"
            onClick={() => {
              const fraction = subtotal % 1000;
              setDiscountAmount((prev) => Math.min(subtotal, prev + fraction));
              setDiscountReason("千円未満切捨");
            }}
            className="px-2.5 py-1 text-xs font-black bg-stone-900 hover:bg-stone-800 text-stone-200 hover:text-white rounded-xl border border-stone-700 cursor-pointer shadow-xs transition-all"
          >
            千円未満切捨 (+¥{(subtotal % 1000).toLocaleString()})
          </button>
        )}
        {subtotal % 10000 > 0 && (
          <button
            type="button"
            onClick={() => {
              const fraction = subtotal % 10000;
              setDiscountAmount((prev) => Math.min(subtotal, prev + fraction));
              setDiscountReason("万円未満切捨");
            }}
            className="px-2.5 py-1 text-xs font-black bg-stone-900 hover:bg-stone-800 text-stone-200 hover:text-white rounded-xl border border-stone-700 cursor-pointer shadow-xs transition-all"
          >
            万円未満切捨 (+¥{(subtotal % 10000).toLocaleString()})
          </button>
        )}
        {[5000, 10000, 20000, 50000, 100000].map((amt) => (
          <button
            type="button"
            key={amt}
            onClick={() => {
              setDiscountAmount((prev) => Math.min(subtotal, prev + amt));
            }}
            className="px-2.5 py-1 text-xs font-black bg-stone-900 hover:bg-stone-800 active:scale-95 text-stone-100 hover:text-amber-300 rounded-xl border border-stone-700 hover:border-amber-500/60 cursor-pointer shadow-xs transition-all"
          >
            +{amt >= 10000 ? `${amt / 10000}万` : amt.toLocaleString()}円
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-stone-800/60">
        <span className="text-[11px] text-stone-400 font-bold shrink-0">値引き理由（任意）:</span>
        <div className="flex items-center gap-1 flex-wrap">
          {["端数サービス", "常連様割引", "まとめ買い割", "キャンペーン", "タイムセール"].map((tag) => (
            <button
              type="button"
              key={tag}
              onClick={() => setDiscountReason(tag)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer border ${
                discountReason === tag
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                  : "bg-stone-900 text-stone-400 hover:text-stone-200 border-stone-800"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={discountReason}
          onChange={(e) => setDiscountReason(e.target.value)}
          placeholder="自由入力..."
          className="text-xs bg-stone-900 px-2.5 py-1 rounded-lg border border-stone-800 text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500 flex-1 max-w-xs"
        />
      </div>
    </div>
  );

  // ④ 商品一覧リスト（カテゴリータブ ＆ カード）
  const renderProductList = () => (
    <div className="space-y-3">
      {/* カテゴリー切り替えタブ */}
      {currentShopCategories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin px-1">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
              selectedCategory === "all"
                ? "bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-950/40"
                : "bg-stone-900 text-stone-400 border-stone-800 hover:text-white hover:border-stone-700"
            }`}
          >
            すべて ({currentShopProducts.length})
          </button>
          {currentShopCategories.map((cat) => {
            const count = currentShopProducts.filter(
              (p) => (p.category_name || "未分類") === cat.name
            ).length;
            const isSelected = selectedCategory === cat.name;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border ${
                  isSelected
                    ? "bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-950/40"
                    : "bg-stone-900 text-stone-400 border-stone-800 hover:text-white hover:border-stone-700"
                }`}
              >
                <span>{cat.icon || "📁"}</span>
                <span>{cat.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-rose-600 text-white" : "bg-stone-800 text-stone-400"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 商品一覧カード */}
      <div className="grid grid-cols-1 gap-3">
        {displayedProducts.map((item) => {
          const currentQty = quantities[item.id] || 0;
          const itemSubtotal = item.selling_price * currentQty;

          return (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all duration-150 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                currentQty > 0
                  ? "bg-stone-800/90 border-rose-500/50 shadow-lg shadow-rose-950/20 ring-1 ring-rose-500/30"
                  : "bg-stone-900/60 border-stone-800 hover:border-stone-700"
              }`}
            >
              {/* 写真・品名・価格・現在庫・必要素材レシピ */}
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-16 h-16 rounded-xl object-cover border border-stone-700 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center shrink-0 text-stone-500 text-xs">
                    No Photo
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-sm sm:text-base text-white truncate">
                      {item.name}
                    </h3>
                    {item.category_name && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-800 text-stone-300 border border-stone-700">
                        {categories.find((c) => c.name === item.category_name)?.icon || "📁"} {item.category_name}
                      </span>
                    )}
                    <span className="text-xs font-black text-rose-400">
                      {formatCurrency(item.selling_price)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs mt-1">
                    {storeSettings.enableInventory ? (
                      <span className="text-stone-400">
                        現在庫:{" "}
                        <strong
                          className={`font-black ${
                            item.current_stock > 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {item.current_stock}
                        </strong>{" "}
                        {item.unit}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/40">
                        在庫無制限
                      </span>
                    )}

                    {currentQty > 0 && (
                      <span className="text-rose-300 font-bold bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                        小計: {formatCurrency(itemSubtotal)}
                      </span>
                    )}
                  </div>

                  {/* レシピ素材バッジ */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <span className="text-[10px] text-stone-500 font-bold">必要素材:</span>
                    {item.recipe && item.recipe.length > 0 ? (
                      item.recipe.map((req, idx) => {
                        const ingItem = ingredients.find((i) => i.id === req.ingredient_id);
                        const ingStock = ingItem ? ingItem.current_stock : 0;
                        const isShort = ingStock < req.quantity * (currentQty || 1);

                        return (
                          <span
                            key={idx}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 ${
                              isShort && currentQty > 0
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                : "bg-stone-800 text-stone-300 border-stone-700"
                            }`}
                          >
                            <span>
                              {req.ingredient_name} × {req.quantity}
                            </span>
                            <span className="text-[9px] text-stone-500">
                              (在庫:{ingStock})
                            </span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-stone-500 italic">
                        素材不要 (レシピ未設定)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 個数入力 & クイック加算ボタン [0] [1] [10] [100] */}
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 self-stretch md:self-auto justify-end">
                <div className="flex items-center bg-stone-950 rounded-xl border border-stone-700 p-1">
                  <button
                    type="button"
                    onClick={() => handleSetQuantity(item.id, currentQty - 1)}
                    className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <input
                    type="number"
                    min="0"
                    value={currentQty === 0 ? "" : currentQty}
                    onChange={(e) =>
                      handleSetQuantity(item.id, parseInt(e.target.value, 10) || 0)
                    }
                    placeholder="0"
                    className="w-16 text-center font-black text-white text-base bg-transparent focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => handleSetQuantity(item.id, currentQty + 1)}
                    className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {[0, 1, 10, 100].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleQuickAdd(item.id, num)}
                      className={`w-11 h-10 rounded-xl border font-black text-sm transition-all shadow-md active:scale-95 flex items-center justify-center cursor-pointer ${
                        num === 0
                          ? "bg-stone-800 hover:bg-stone-700 border-stone-600 text-stone-300"
                          : "bg-stone-800 hover:bg-stone-700 border-stone-600 hover:border-rose-500 text-white"
                      }`}
                      title={num === 0 ? "個数を0にリセット" : `+${num} 個加算`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ⑤ 複数人分担・出張修理入力パネル（三枚目の画像を全体レイアウトに拡張）
  const renderStaffAssignmentSection = () => (
    <div className="bg-stone-900 border border-indigo-900/50 p-5 sm:p-6 rounded-2xl shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-900/50 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Users className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-indigo-200 flex items-center gap-2">
              👥 複数人共同作業・出張修理の分担設定
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                🟢 クラウド同期中
              </span>
            </h3>
            <p className="text-xs text-stone-400">
              修理箇所数や台数に応じて、この売上実績を参加スタッフに自動按分します。他の人が入力した内容もリアルタイム同期されます。
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (users.length === 0) return;
            const existingUserIds = new Set(staffAssignments.map((s) => s.userId));
            const candidate = users.find((u) => !existingUserIds.has(u.id)) || users[0];
            setStaffAssignments((prev) => [
              ...prev,
              { userId: candidate.id, staffName: candidate.displayName, workCount: 1 },
            ]);
          }}
          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer self-start sm:self-auto transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>スタッフを追加</span>
        </button>
      </div>

      {/* 修理内容メモ & 合計箇所数 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 space-y-1">
          <label className="text-xs font-bold text-stone-300 flex items-center gap-1">
            <Wrench className="w-3.5 h-3.5 text-indigo-400" />
            修理内容・修理箇所メモ (任意):
          </label>
          <input
            type="text"
            value={workLocations}
            onChange={(e) => setWorkLocations(e.target.value)}
            placeholder="例: フロントドア板金、エンジン調整、バンパー交換..."
            className="w-full px-3.5 py-2 bg-stone-950 rounded-xl border border-stone-700 text-xs text-white placeholder-stone-500 focus:border-indigo-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-stone-300 block">
            合計{currentShopInfo.workTypeLabel || "修理箇所数"} / 台数:
          </label>
          <div className="flex items-center gap-2 bg-stone-950 px-3 py-1.5 rounded-xl border border-stone-700">
            <input
              type="number"
              min="1"
              value={totalWorkCount}
              onChange={(e) => setTotalWorkCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-transparent text-center font-black text-indigo-300 text-base focus:outline-none"
            />
            <span className="text-xs text-stone-400 font-bold shrink-0">
              {currentShopInfo.workTypeLabel || "箇所"}
            </span>
          </div>
        </div>
      </div>

      {/* スタッフ分担リスト */}
      <div className="space-y-2.5 pt-2">
        <div className="flex items-center justify-between text-xs font-bold text-stone-400">
          <span>担当スタッフと各自の担当箇所数:</span>
          <span className="text-[11px] font-mono">
            合計: {staffAssignments.reduce((a, s) => a + s.workCount, 0)} / 目標 {totalWorkCount}{currentShopInfo.workTypeLabel || "箇所"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {staffAssignments.map((assign, idx) => {
            const sumShares = staffAssignments.reduce((acc, s) => acc + s.workCount, 0);
            const shareRate = sumShares > 0 ? assign.workCount / sumShares : 1 / staffAssignments.length;
            const allocAmt = Math.round(finalTotalAmount * shareRate);

            return (
              <div
                key={idx}
                className="bg-stone-950/90 p-3 rounded-xl border border-stone-800 space-y-2.5 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={assign.userId}
                    onChange={(e) => {
                      const selectedUser = users.find((u) => u.id === e.target.value);
                      if (!selectedUser) return;
                      setStaffAssignments((prev) =>
                        prev.map((s, i) =>
                          i === idx
                            ? { ...s, userId: selectedUser.id, staffName: selectedUser.displayName }
                            : s
                        )
                      );
                    }}
                    className="bg-stone-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-stone-700 focus:border-indigo-500 flex-1 min-w-0 truncate cursor-pointer"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName} ({u.roleName || (u.role === "executive" ? "幹部" : "スタッフ")})
                      </option>
                    ))}
                  </select>

                  {staffAssignments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setStaffAssignments((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-stone-800 transition-colors shrink-0 cursor-pointer"
                      title="担当から削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-800/80 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-stone-400 font-bold shrink-0">担当:</span>
                    <div className="flex items-center bg-stone-900 rounded-lg border border-stone-700 p-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          const val = Math.max(1, assign.workCount - 1);
                          setStaffAssignments((prev) =>
                            prev.map((s, i) => (i === idx ? { ...s, workCount: val } : s))
                          );
                        }}
                        className="w-6 h-6 flex items-center justify-center text-stone-400 hover:text-white rounded hover:bg-stone-800 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={assign.workCount}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          setStaffAssignments((prev) =>
                            prev.map((s, i) => (i === idx ? { ...s, workCount: val } : s))
                          );
                        }}
                        className="w-10 bg-transparent text-center font-black text-indigo-300 text-xs focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = assign.workCount + 1;
                          setStaffAssignments((prev) =>
                            prev.map((s, i) => (i === idx ? { ...s, workCount: val } : s))
                          );
                        }}
                        className="w-6 h-6 flex items-center justify-center text-stone-400 hover:text-white rounded hover:bg-stone-800 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-[11px] text-stone-400 font-bold shrink-0">
                      {currentShopInfo.workTypeLabel || "箇所"}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-amber-300 font-mono">
                      {formatCurrency(allocAmt)}
                    </span>
                    <span className="text-[10px] text-stone-400 ml-1">
                      ({(shareRate * 100).toFixed(0)}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 箇所数合致チェックインジケータ */}
        {(() => {
          const sumCount = staffAssignments.reduce((acc, s) => acc + s.workCount, 0);
          const isMatched = sumCount === totalWorkCount;
          return (
            <div className="flex items-center justify-between text-xs pt-1 px-1 flex-wrap gap-2">
              <span className="text-stone-400">
                担当合計: <strong className="text-white">{sumCount}{currentShopInfo.workTypeLabel || "箇所"}</strong> / 目標: <strong className="text-indigo-300">{totalWorkCount}{currentShopInfo.workTypeLabel || "箇所"}</strong>
              </span>
              {!isMatched ? (
                <span className="text-amber-400 font-bold flex items-center gap-1 text-[11px]">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  箇所数不一致（按分比率で自動計算）
                </span>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  箇所数一致
                </span>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );

  // ⑥ 通知・警告メッセージ表示
  const renderNotifications = () => (
    <>
      {realtimeNotice && (
        <div className="max-w-[1700px] mx-auto mb-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>{realtimeNotice}</span>
        </div>
      )}

      {notification && (
        <div
          className={`max-w-[1700px] mx-auto mb-3 p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
            notification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-stone-400 hover:text-white text-xs ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {lastCraft && (
        <div className="max-w-[1700px] mx-auto mb-3 p-3 rounded-xl border border-amber-500/40 bg-amber-950/30 text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2 text-amber-300">
            <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              直前に作成した商品: <strong className="text-white underline">{lastCraft.names.join("、")}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRollbackLastCraft}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>作成を取り消す (在庫・素材を戻す)</span>
            </button>
            <button
              type="button"
              onClick={() => setLastCraft(null)}
              className="text-stone-400 hover:text-white text-xs px-2 py-1 cursor-pointer"
              title="閉じる"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="w-full min-h-full px-3 sm:px-4 md:px-6 py-4">
      {renderNotifications()}

      {isMultiStaffShop ? (
        /* ========================================================
           🛠️ 分担あり店舗: ワイド1カラム（セパレートなし）出張修理伝票UI
           三枚目の画像を全体レイアウトにし、登録商品選択を統合
           ======================================================== */
        <div className="max-w-5xl mx-auto space-y-5 pb-24">
          {/* ① 店舗切り替えセレクター */}
          {renderShopSelector(true)}

          {/* ② 出張修理・複数人共同作業の分担設定カード */}
          {renderStaffAssignmentSection()}

          {/* ③ 使用パーツ・修理メニューの選択（登録商品一覧） */}
          <div className="bg-stone-900 border border-stone-800 p-5 sm:p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-stone-800 pb-3">
              <h2 className="text-sm font-bold text-stone-300 uppercase tracking-wider flex items-center gap-2">
                <Boxes className="w-4 h-4 text-rose-500" />
                使用パーツ・修理メニュー選択 ({displayedProducts.length}点)
              </h2>
              <span className="text-[11px] text-stone-400">
                ※作業で使用した部品や工賃メニューを選択してください（個数ボタンで素早く入力可能）
              </span>
            </div>

            {renderProductList()}
          </div>

          {/* ④ 選択中パーツ明細 & 合計請求額 & 登録アクションバー */}
          <div className="bg-stone-900/95 border border-stone-800 p-5 rounded-2xl shadow-2xl space-y-4 sticky bottom-4 z-30 backdrop-blur-md">
            {/* 選択中の商品一覧 */}
            {selectedItemsList.length > 0 && renderCartItemsList(true)}

            {/* 値引きパネル */}
            {(showDiscountForm || validDiscount > 0) && totalItemsCount > 0 && renderDiscountPanel()}

            {/* 会計合計 ＆ 売上登録アクション */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <span className="text-xs font-bold text-stone-400 block">
                    合計請求金額 ({totalItemsCount}点):
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                      {formatCurrency(finalTotalAmount)}
                    </span>
                    {validDiscount > 0 && (
                      <span className="text-xs font-bold text-amber-400">
                        値引き: -¥{validDiscount.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                {totalItemsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowDiscountForm(!showDiscountForm)}
                    className={`h-9 px-3 rounded-xl border transition-all cursor-pointer font-bold text-xs flex items-center gap-1.5 ${
                      validDiscount > 0
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                        : "bg-stone-950 text-stone-300 hover:text-white border-stone-800"
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5 text-amber-400" />
                    <span>{validDiscount > 0 ? "値引き調整中" : "値引き"}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {totalItemsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="px-3.5 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>クリア</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSell}
                  disabled={totalItemsCount === 0}
                  className={`flex-1 sm:flex-none h-12 px-6 rounded-xl font-extrabold text-sm text-white shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    totalItemsCount > 0
                      ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-950/60"
                      : "bg-stone-800 text-stone-500 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <Wrench className="w-4 h-4 shrink-0" />
                  <span>出張修理を完了して登録 (在庫減算 ＆ 各自に按分)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================
           🏪 分担なし店舗: 従来の2カラム店頭販売（左に会計、右に商品一覧）
           ======================================================== */
        <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row gap-4 md:gap-6 items-start pb-16">
          {/* 🟥 左カラム: 店舗切り替え ＆ 会計・アクションパネル */}
          <div className="w-full md:w-[380px] lg:w-[420px] xl:w-[440px] shrink-0 space-y-4 md:sticky md:top-4 z-20 md:max-h-[calc(100vh-5rem)] md:overflow-y-auto md:pr-1.5 custom-scrollbar pb-8">
            {renderShopSelector(false)}

            {/* 会計＆アクションパネル */}
            <div className="bg-stone-900 border border-stone-800 p-4 sm:p-5 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-stone-800/80 pb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl border border-stone-800 p-1 flex items-center justify-center shadow-lg shrink-0 overflow-hidden bg-stone-950">
                    {currentShopInfo.id === "sakura" && siteBranding.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={siteBranding.logoUrl}
                        alt={currentShopInfo.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-2xl">{currentShopInfo.icon || "🏪"}</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-stone-400 block truncate">
                      【{currentShopInfo.name}】選択中 ({totalItemsCount}点)
                    </span>

                    <div className="flex items-baseline gap-2 whitespace-nowrap">
                      <span className="text-xs font-bold text-stone-400">合計:</span>
                      <span className="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono">
                        {formatCurrency(finalTotalAmount)}
                      </span>
                    </div>
                    {validDiscount > 0 && (
                      <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5 mt-0.5">
                        <span>値引き: -¥{validDiscount.toLocaleString()}</span>
                        <span className="text-stone-500 line-through">
                          (小計 {formatCurrency(subtotal)})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {totalItemsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="px-2.5 py-1 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white border border-stone-700 transition-colors cursor-pointer text-[11px] font-bold flex items-center gap-1 shrink-0"
                    title="選択をクリア"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    <span>クリア</span>
                  </button>
                )}
              </div>

              {/* カート明細 */}
              {renderCartItemsList(false)}

              {/* アクションボタン: 売る & 作成 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSell}
                  disabled={totalItemsCount === 0}
                  className={`h-12 px-4 rounded-xl font-extrabold text-sm text-white shadow-md flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer ${
                    storeSettings.enableCrafting ? "sm:col-span-1" : "sm:col-span-2"
                  } ${
                    totalItemsCount > 0
                      ? "bg-rose-700 hover:bg-rose-600 shadow-rose-950/50"
                      : "bg-stone-800 text-stone-500 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                  <span>売る (在庫減算)</span>
                </button>

                {storeSettings.enableCrafting && (
                  <button
                    type="button"
                    onClick={handleCraft}
                    disabled={totalItemsCount === 0}
                    className={`h-12 px-4 rounded-xl font-extrabold text-sm text-white shadow-md flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer ${
                      totalItemsCount > 0
                        ? "bg-emerald-700 hover:bg-emerald-600 shadow-emerald-950/50"
                        : "bg-stone-800 text-stone-500 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <Hammer className="w-4 h-4 shrink-0" />
                    <span>作成 (在庫増)</span>
                  </button>
                )}
              </div>

              {/* 値引きボタン */}
              {totalItemsCount > 0 && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDiscountForm(!showDiscountForm)}
                    className={`w-full h-9 px-3 rounded-xl border transition-all cursor-pointer font-bold text-xs flex items-center justify-center gap-1.5 ${
                      validDiscount > 0
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs"
                        : showDiscountForm
                        ? "bg-stone-700 text-white border-stone-600"
                        : "bg-stone-950 text-stone-300 hover:text-white border-stone-800 hover:bg-stone-800"
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{validDiscount > 0 ? "値引き調整中" : "値引きを設定"}</span>
                  </button>
                </div>
              )}

              {/* 値引きパネル */}
              {(showDiscountForm || validDiscount > 0) && totalItemsCount > 0 && renderDiscountPanel()}
            </div>
          </div>

          {/* 🟦 右カラム: 商品一覧 */}
          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-2 gap-1.5">
              <h2 className="text-sm font-bold text-stone-300 uppercase tracking-wider flex items-center gap-2">
                <Boxes className="w-4 h-4 text-rose-500" />
                【{currentShopInfo.name}】商品一覧 ({displayedProducts.length}点
                {selectedCategory !== "all" && ` / 全${currentShopProducts.length}点`})
              </h2>
              <span className="text-[11px] text-stone-400">
                ※カテゴリー順に並んでいます。「作成」を押すと必要な素材が自動消費されます
              </span>
            </div>

            {renderProductList()}
          </div>
        </div>
      )}
    </div>
  );
}
