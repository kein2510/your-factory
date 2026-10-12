"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Search,
  Check,
  X,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { formatCurrency } from "@/lib/utils";
import { ShopId, MultiStaffAssignment } from "@/types";
import { supabase } from "@/lib/supabase";

interface StaffAssignmentInput {
  userId: string;
  staffName: string;
  workCount?: number; // 担当箇所数 / 点数
  items?: Record<string, number>; // { [itemId: string]: quantity } 各自が担当した商品と個数
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
  const [workLocations, setWorkLocations] = useState<string>(""); // メモ欄はUI非表示
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignmentInput[]>([]);
  const [sharedDraftNotice, setSharedDraftNotice] = useState<string | null>(null);

  // 分担店舗用: 選択された商品（パーツ・修理メニュー）IDのセット
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // スタッフ追加モーダル開閉ステート
  const [isStaffModalOpen, setIsStaffModalOpen] = useState<boolean>(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>("");

  // 端末・セッション一意のクライアントID（自分自身のRealtimeエコーバックによる数値巻き戻りを防ぐ）
  const clientIdRef = useRef<string>("");
  if (!clientIdRef.current) {
    clientIdRef.current =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `client_${Date.now()}_${Math.random()}`;
  }
  // 手元での最新編集タイムスタンプ（入力中のリモート上書きを防ぐ）
  const lastLocalEditTimeRef = useRef<number>(0);

  // ログインユーザーが変わった時、または初期化時に自身をデフォルト設定
  useEffect(() => {
    if (currentUser && staffAssignments.length === 0) {
      setStaffAssignments([
        { userId: currentUser.id, staffName: currentUser.displayName, workCount: 0, items: {} },
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
              selectedProductIds?: string[];
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
            if (Array.isArray(val.selectedProductIds)) {
              setSelectedProductIds(val.selectedProductIds);
            } else if (val.quantities) {
              setSelectedProductIds(Object.keys(val.quantities));
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
              setStaffAssignments([{ userId: currentUser.id, staffName: currentUser.displayName, workCount: 0, items: {} }]);
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
            clientId: clientIdRef.current, // 自身のクライアントID
            quantities,
            selectedProductIds,
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
    selectedProductIds,
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
    setSelectedProductIds([]);
    setDiscountAmount(0);
    setDiscountReason("");
    setShowDiscountForm(false);
    setTotalWorkCount(1);
    setWorkLocations("");
    if (currentUser) {
      setStaffAssignments([
        { userId: currentUser.id, staffName: currentUser.displayName, workCount: 0, items: {} },
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
              clientId?: string;
              quantities?: { [itemId: string]: number };
              selectedProductIds?: string[];
              totalWorkCount?: number;
              workLocations?: string;
              staffAssignments?: StaffAssignmentInput[];
              discountAmount?: number;
              discountReason?: string;
              updatedBy?: string;
            } | null;

            if (val) {
              // 自身の送信（エコーバック）なら状態を上書きしない
              if (val.clientId === clientIdRef.current) {
                return;
              }
              // 手元で直近1.8秒以内に入力操作を行っていた場合は、リモート上書きを保留して入力を保護する
              if (Date.now() - lastLocalEditTimeRef.current < 1800) {
                return;
              }

              if (val.quantities) setQuantities(val.quantities);
              if (Array.isArray(val.selectedProductIds)) {
                setSelectedProductIds(val.selectedProductIds);
              } else if (val.quantities) {
                setSelectedProductIds(Object.keys(val.quantities));
              }
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

  // 伝票に対象として選択されている商品IDの統合リスト
  const effectiveSelectedProductIds = useMemo(() => {
    const ids = new Set<string>(selectedProductIds);
    Object.keys(quantities).forEach((id) => {
      if ((quantities[id] || 0) > 0) ids.add(id);
    });
    staffAssignments.forEach((s) => {
      Object.keys(s.items || {}).forEach((id) => {
        if ((s.items?.[id] || 0) > 0) ids.add(id);
      });
    });
    return Array.from(ids);
  }, [selectedProductIds, quantities, staffAssignments]);

  // 分担店舗用: 商品を伝票に「選択」または「解除」するハンドラ（個数は上の個人で入れる）
  const handleToggleProductSelection = (itemId: string) => {
    lastLocalEditTimeRef.current = Date.now();
    const isAlreadySelected = effectiveSelectedProductIds.includes(itemId);

    if (isAlreadySelected) {
      // 選択解除: 全スタッフの担当個数をクリア
      setSelectedProductIds((prev) => prev.filter((id) => id !== itemId));
      setStaffAssignments((curStaff) =>
        curStaff.map((s) => {
          const newItems = { ...(s.items || {}) };
          delete newItems[itemId];
          const newCount = Object.values(newItems).reduce((sum, n) => sum + n, 0);
          return { ...s, items: newItems, workCount: newCount };
        })
      );
      setQuantities((prevQ) => {
        const next = { ...prevQ };
        delete next[itemId];
        return next;
      });
    } else {
      // 伝票に追加（選択）
      setSelectedProductIds((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));

      // スタッフが1名のみの場合は初期個数1を自動セット、複数名の場合は上のスタッフ欄で入力
      if (staffAssignments.length === 1) {
        setStaffAssignments((curStaff) => {
          if (curStaff.length !== 1) return curStaff;
          const curItems = { ...(curStaff[0].items || {}), [itemId]: 1 };
          const newCount = Object.values(curItems).reduce((s, n) => s + n, 0);
          return [{ ...curStaff[0], items: curItems, workCount: newCount }];
        });
        setQuantities((prevQ) => ({ ...prevQ, [itemId]: 1 }));
      }
    }
  };

  // 個数更新（通常店舗用）
  const handleSetQuantity = (itemId: string, qty: number) => {
    lastLocalEditTimeRef.current = Date.now();
    const nextQty = Math.max(0, qty);
    setQuantities((prev) => {
      const updated = { ...prev, [itemId]: nextQty };
      return updated;
    });

    if (isMultiStaffShop && staffAssignments.length === 1) {
      setStaffAssignments((prev) => {
        if (prev.length !== 1) return prev;
        const curItems = { ...(prev[0].items || {}) };
        if (nextQty > 0) {
          curItems[itemId] = nextQty;
        } else {
          delete curItems[itemId];
        }
        const newCount = Object.values(curItems).reduce((s, n) => s + n, 0);
        return [{ ...prev[0], items: curItems, workCount: newCount }];
      });
    }
  };

  // スタッフごとの商品個数の変更（個数の入力は上の個人でやる）
  const handleSetStaffItemQuantity = (staffIndex: number, itemId: string, qty: number) => {
    lastLocalEditTimeRef.current = Date.now();
    const nextQty = Math.max(0, qty);

    setStaffAssignments((prev) => {
      const updated = [...prev];
      if (!updated[staffIndex]) return prev;

      const currentItems = { ...(updated[staffIndex].items || {}) };
      if (nextQty > 0) {
        currentItems[itemId] = nextQty;
      } else {
        delete currentItems[itemId];
      }

      const newWorkCount = Object.values(currentItems).reduce((sum, n) => sum + n, 0);
      updated[staffIndex] = {
        ...updated[staffIndex],
        items: currentItems,
        workCount: newWorkCount,
      };

      // 分担店舗の場合: 全体カートの数量は全スタッフの担当個数の合計と常に完全一致させる
      if (isMultiStaffShop) {
        const totalAssigned = updated.reduce((sum, s) => sum + (s.items?.[itemId] || 0), 0);
        setQuantities((prevQ) => {
          if (totalAssigned > 0) {
            return { ...prevQ, [itemId]: totalAssigned };
          } else {
            const nextQ = { ...prevQ };
            delete nextQ[itemId];
            return nextQ;
          }
        });
      }

      return updated;
    });
  };

  // 全体で選択されている商品を参加スタッフ全員に均等割り当て
  const handleDistributeItemsEqually = () => {
    lastLocalEditTimeRef.current = Date.now();
    if (staffAssignments.length === 0) return;

    const staffCount = staffAssignments.length;
    const newAssignments = staffAssignments.map((s) => ({
      ...s,
      items: {} as Record<string, number>,
      workCount: 0,
    }));

    Object.entries(quantities).forEach(([itemId, totalQty]) => {
      if (totalQty <= 0) return;
      const basePerStaff = Math.floor(totalQty / staffCount);
      let remainder = totalQty % staffCount;

      newAssignments.forEach((s) => {
        let count = basePerStaff;
        if (remainder > 0) {
          count += 1;
          remainder -= 1;
        }
        if (count > 0) {
          s.items[itemId] = count;
        }
      });
    });

    newAssignments.forEach((s) => {
      s.workCount = Object.values(s.items).reduce((acc, q) => acc + q, 0);
    });

    setStaffAssignments(newAssignments);
    setNotification({ type: "success", message: "選択中の全商品をスタッフに均等に振り分けました！" });
    setTimeout(() => setNotification(null), 3000);
  };

  // 画像2枚目のクイック加算ボタン [0], [1], [10], [100]
  const handleQuickAdd = (itemId: string, addAmount: number) => {
    lastLocalEditTimeRef.current = Date.now();
    if (addAmount === 0) {
      handleSetQuantity(itemId, 0);
    } else {
      const current = quantities[itemId] || 0;
      handleSetQuantity(itemId, current + addAmount);
    }
  };

  // 全リセット
  const handleResetAll = () => {
    lastLocalEditTimeRef.current = Date.now();
    clearDraft();
    setNotification(null);
  };

  // 店舗切り替え
  const handleSwitchShop = (shopId: string) => {
    if (selectedShopId !== shopId) {
      lastLocalEditTimeRef.current = Date.now();
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

  // 選択中の商品詳細リスト（カート明細用）
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

  // 各スタッフの担当商品合計金額および担当点数の計算
  const staffCalculatedList = useMemo(() => {
    const discountRate = subtotal > 0 ? finalTotalAmount / subtotal : 1;

    return staffAssignments.map((s) => {
      const itemsMap = s.items || {};
      const totalCount = Object.values(itemsMap).reduce((sum, q) => sum + q, 0);

      const staffRawSubtotal = Object.entries(itemsMap).reduce((sum, [id, q]) => {
        const it = items.find((i) => i.id === id);
        return sum + (it?.selling_price || 0) * q;
      }, 0);

      // 値引き反映後のスタッフ按分金額
      const staffAllocated = Math.round(staffRawSubtotal * discountRate);

      return {
        ...s,
        totalCount,
        staffRawSubtotal,
        staffAllocated,
      };
    });
  }, [staffAssignments, items, subtotal, finalTotalAmount]);

  // 「売る」実行
  const handleSell = () => {
    if (totalItemsCount === 0) {
      setNotification({ type: "error", message: "販売する商品の個数を指定してください。" });
      return;
    }

    // 複数人共同作業（出張修理）データの構築
    let multiStaffData: MultiStaffAssignment | undefined = undefined;
    if (isMultiStaffShop && staffAssignments.length > 0) {
      const totalStaffSub = staffCalculatedList.reduce((sum, s) => sum + s.staffRawSubtotal, 0);

      let allocatedTotal = 0;
      const shares = staffCalculatedList.map((s, idx) => {
        let alloc = s.staffAllocated;

        // スタッフにまだアイテムが割り当てられていない場合は均等按分
        if (totalStaffSub === 0) {
          alloc = Math.round(finalTotalAmount / staffCalculatedList.length);
        }

        if (idx === staffCalculatedList.length - 1) {
          // 最終行で端数調整を行い、合計金額と完全に一致させる
          alloc = Math.max(0, finalTotalAmount - allocatedTotal);
        } else {
          allocatedTotal += alloc;
        }

        const rate = finalTotalAmount > 0 ? alloc / finalTotalAmount : 1 / staffCalculatedList.length;

        return {
          userId: s.userId,
          staffName: s.staffName,
          workCount: Math.max(1, s.totalCount || s.workCount || 1),
          shareRate: rate,
          allocatedAmount: Math.max(0, alloc),
          items: s.items || {},
        };
      });

      multiStaffData = {
        enabled: true,
        totalWorkCount: Math.max(1, totalItemsCount),
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
          const isSelectedInMulti = isMultiStaffShop && effectiveSelectedProductIds.includes(item.id);

          return (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all duration-150 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                isSelectedInMulti || currentQty > 0
                  ? "bg-stone-800/90 border-indigo-500/60 shadow-lg shadow-indigo-950/20 ring-1 ring-indigo-500/40"
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
                        小計: {formatCurrency(itemSubtotal)} ({currentQty}点)
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

              {/* 右側: 分担店舗の場合は「選択のみ」ボタン、通常店舗の場合は個数スピン */}
              {isMultiStaffShop ? (
                <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
                  <button
                    type="button"
                    onClick={() => handleToggleProductSelection(item.id)}
                    className={`h-11 px-5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md active:scale-95 ${
                      isSelectedInMulti
                        ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-950/40 ring-1 ring-rose-400/50"
                        : "bg-stone-800 hover:bg-indigo-600 hover:text-white text-stone-200 border border-stone-700 hover:border-indigo-500"
                    }`}
                  >
                    {isSelectedInMulti ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>✓ 伝票に追加中 (解除)</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 text-indigo-400" />
                        <span>＋ 伝票に追加 (選択)</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* 通常店舗: 個数入力 & クイック加算ボタン [0] [1] [10] [100] */
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 self-stretch md:self-auto justify-end">
                  <div className="flex items-center bg-stone-950 rounded-xl border border-stone-700 p-1">
                    <button
                      type="button"
                      onClick={() => handleSetQuantity(item.id, currentQty - 1)}
                      className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors cursor-pointer"
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
                      className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors cursor-pointer"
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ⑤ スタッフ追加モーダル（全スタッフ一覧から選択）
  const renderStaffSelectModal = () => {
    if (!isStaffModalOpen) return null;

    const filteredUsers = users.filter((u) => {
      if (!staffSearchQuery.trim()) return true;
      const q = staffSearchQuery.toLowerCase();
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.roleName || "").toLowerCase().includes(q)
      );
    });

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-stone-900 border border-stone-700 w-full max-w-lg rounded-2xl shadow-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Users className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-black text-white">
                  出張修理スタッフの追加・選択
                </h3>
                <p className="text-xs text-stone-400">
                  今回の作業に参加するスタッフを選択してください（複数人選択可能）
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsStaffModalOpen(false)}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 検索バー */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              type="text"
              value={staffSearchQuery}
              onChange={(e) => setStaffSearchQuery(e.target.value)}
              placeholder="スタッフ名や役職で検索..."
              className="w-full pl-9 pr-3 py-2 bg-stone-950 rounded-xl border border-stone-700 text-xs text-white placeholder-stone-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* スタッフ一覧 */}
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-6 text-stone-500 text-xs font-bold">
                該当するスタッフが見つかりません
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = staffAssignments.some((s) => s.userId === u.id);

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      lastLocalEditTimeRef.current = Date.now();
                      if (isSelected) {
                        if (staffAssignments.length <= 1) {
                          alert("最低1名の担当スタッフが必要です。");
                          return;
                        }
                        setStaffAssignments((prev) => prev.filter((s) => s.userId !== u.id));
                      } else {
                        setStaffAssignments((prev) => [
                          ...prev,
                          { userId: u.id, staffName: u.displayName, workCount: 0, items: {} },
                        ]);
                      }
                    }}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? "bg-indigo-950/40 border-indigo-500/60 shadow-md ring-1 ring-indigo-500/30"
                        : "bg-stone-950 border-stone-800 hover:border-stone-700 hover:bg-stone-800/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center font-black text-sm text-white shrink-0">
                        {u.displayName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-white truncate">
                            {u.displayName}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-stone-800 text-stone-300 border border-stone-700">
                            {u.roleName || (u.role === "executive" ? "幹部" : "スタッフ")}
                          </span>
                        </div>
                        <span className="text-[11px] text-stone-500 block truncate">
                          @{u.username}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 ml-2">
                      {isSelected ? (
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-black flex items-center gap-1 shadow-xs">
                          <Check className="w-3.5 h-3.5" />
                          <span>参加中</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-stone-800 text-stone-400 text-xs font-bold hover:text-white">
                          ＋ 追加
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-stone-800 pt-3">
            <span className="text-xs text-stone-400 font-bold">
              現在選択中: <strong className="text-white">{staffAssignments.length}名</strong>
            </span>
            <button
              type="button"
              onClick={() => setIsStaffModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md cursor-pointer transition-all"
            >
              決定して閉じる
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ⑥ 複数人分担・出張修理入力パネル（各スタッフカード内に選択商品を割り当て）
  const renderStaffAssignmentSection = () => {
    // 伝票に対象として選択されている商品IDのリスト
    const targetItemIds = effectiveSelectedProductIds;

    // 全商品の割り当て状況の集計
    const totalAssignedAllStaff = staffAssignments.reduce((acc, s) => {
      const itemsMap = s.items || {};
      return acc + Object.values(itemsMap).reduce((sum, q) => sum + q, 0);
    }, 0);

    return (
      <div className="bg-stone-900 border border-indigo-900/50 p-5 sm:p-6 rounded-2xl shadow-xl space-y-4">
        {/* ヘッダー: タイトル & 均等分配 & スタッフ追加ボタン */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-900/50 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
              <Users className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-indigo-200 flex items-center gap-2 flex-wrap">
                <span>👥 出張修理・複数人作業の担当スタッフ</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  🟢 クラウド同期中
                </span>
              </h3>
              <p className="text-xs text-stone-400 truncate">
                各スタッフが担当したパーツ・作業メニューの個数を設定すると、売上実績が自動計算されます。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {targetItemIds.length > 0 && staffAssignments.length > 1 && totalAssignedAllStaff > 0 && (
              <button
                type="button"
                onClick={handleDistributeItemsEqually}
                className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white text-xs font-bold border border-stone-700 flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                title="現在設定されている点数をスタッフ全員に均等に振り分けます"
              >
                <span>⚖️ 全員に均等分配</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setStaffSearchQuery("");
                setIsStaffModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>＋ スタッフを選択追加 ({staffAssignments.length}名)</span>
            </button>
          </div>
        </div>

        {/* スタッフ一覧カード（各スタッフカード内に選択した商品・パーツを埋め込み） */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {staffAssignments.map((assign, staffIdx) => {
            const calculated = staffCalculatedList[staffIdx] || {
              totalCount: 0,
              staffRawSubtotal: 0,
              staffAllocated: 0,
            };

            const staffItemsMap = assign.items || {};
            // このスタッフカードに表示する商品: 伝票に追加されている全商品を展開
            const relevantItemIds = targetItemIds;

            return (
              <div
                key={assign.userId + staffIdx}
                className="bg-stone-950/90 p-4 rounded-2xl border border-stone-800 space-y-3 shadow-md flex flex-col justify-between"
              >
                {/* カード上部: スタッフ名 ＆ 担当者変更 ＆ 削除 */}
                <div className="flex items-center justify-between gap-2 border-b border-stone-800/80 pb-2.5">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-indigo-950/60 text-indigo-300 border border-indigo-700/50 flex items-center justify-center font-black text-xs shrink-0">
                      {assign.staffName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <select
                        value={assign.userId}
                        onChange={(e) => {
                          lastLocalEditTimeRef.current = Date.now();
                          const selectedUser = users.find((u) => u.id === e.target.value);
                          if (!selectedUser) return;
                          setStaffAssignments((prev) =>
                            prev.map((s, i) =>
                              i === staffIdx
                                ? { ...s, userId: selectedUser.id, staffName: selectedUser.displayName }
                                : s
                            )
                          );
                        }}
                        className="bg-stone-900 text-white text-xs font-bold px-2.5 py-1 rounded-lg border border-stone-700 focus:border-indigo-500 w-full truncate cursor-pointer"
                      >
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.displayName} ({u.roleName || (u.role === "executive" ? "幹部" : "スタッフ")})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {staffAssignments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        lastLocalEditTimeRef.current = Date.now();
                        setStaffAssignments((prev) => prev.filter((_, i) => i !== staffIdx));
                      }}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-stone-800 transition-colors shrink-0 cursor-pointer"
                      title="このスタッフを担当から外す"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* カード中段: 選択した商品・使用パーツの担当個数（各個人で個数を入力） */}
                <div className="space-y-2 flex-1 min-h-[70px]">
                  {relevantItemIds.length === 0 ? (
                    <div className="text-center py-4 bg-stone-900/40 rounded-xl border border-dashed border-stone-800 text-stone-500 text-xs">
                      下の商品一覧からパーツ・修理メニューを「＋伝票に追加」してください
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                      {relevantItemIds.map((itemId) => {
                        const it = items.find((i) => i.id === itemId);
                        if (!it) return null;

                        const assignedQty = staffItemsMap[itemId] || 0;
                        const itemSub = it.selling_price * assignedQty;
                        const overallQty = quantities[itemId] || 0;

                        return (
                          <div
                            key={itemId}
                            className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2 text-xs ${
                              assignedQty > 0
                                ? "bg-stone-900/95 border-stone-700 shadow-xs"
                                : "bg-stone-900/30 border-stone-800/80 opacity-60"
                            }`}
                          >
                            {/* 写真 ＆ 品名 ＆ 単価 */}
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {it.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={it.image_url}
                                  alt={it.name}
                                  className="w-7 h-7 rounded-lg object-cover border border-stone-700 shrink-0"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-stone-800 border border-stone-700 flex items-center justify-center text-xs shrink-0 text-stone-500">
                                  📦
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <h5 className="font-extrabold text-white text-xs truncate">
                                  {it.name}
                                </h5>
                                <div className="flex items-center gap-1.5 text-[10px]">
                                  <span className="text-rose-300 font-bold">
                                    {formatCurrency(it.selling_price)}
                                  </span>
                                  {overallQty > 0 && (
                                    <span className="text-stone-500 font-mono">
                                      (全体:{overallQty})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* 担当個数操作 [-] [数値] [+] & 小計 */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="flex items-center bg-stone-950 rounded-lg border border-stone-700 p-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleSetStaffItemQuantity(staffIdx, itemId, assignedQty - 1)}
                                  className="w-5 h-5 flex items-center justify-center text-stone-400 hover:text-white rounded hover:bg-stone-800 cursor-pointer"
                                  title="-1"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  value={assignedQty === 0 ? "" : assignedQty}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                                    handleSetStaffItemQuantity(staffIdx, itemId, isNaN(val) ? 0 : val);
                                  }}
                                  placeholder="0"
                                  className="w-9 bg-transparent text-center font-black text-indigo-300 text-xs focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSetStaffItemQuantity(staffIdx, itemId, assignedQty + 1)}
                                  className="w-5 h-5 flex items-center justify-center text-stone-400 hover:text-white rounded hover:bg-stone-800 cursor-pointer"
                                  title="+1"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>

                              <span className="text-xs font-black text-amber-300 font-mono min-w-[55px] text-right">
                                {formatCurrency(itemSub)}
                              </span>

                              <button
                                type="button"
                                onClick={() => {
                                  if (assignedQty > 0) {
                                    handleSetStaffItemQuantity(staffIdx, itemId, 0);
                                  } else {
                                    handleToggleProductSelection(itemId);
                                  }
                                }}
                                className="text-stone-500 hover:text-rose-400 p-1 rounded hover:bg-stone-800 cursor-pointer transition-colors"
                                title={assignedQty > 0 ? "このスタッフの担当を0にする" : "伝票から除外"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* カード下部: 担当合計点数 ＆ このスタッフの売上金額 */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-800/80 text-xs bg-stone-900/50 px-3 py-2 rounded-xl">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-stone-400 font-bold">担当点数:</span>
                    <strong className="text-white font-mono text-sm">
                      {calculated.totalCount} 点
                    </strong>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-stone-400 mr-1.5">このスタッフの売上:</span>
                    <span className="text-sm font-black text-amber-300 font-mono">
                      {formatCurrency(calculated.staffAllocated)}
                    </span>
                    {finalTotalAmount > 0 && (
                      <span className="text-[10px] text-stone-400 ml-1">
                        ({Math.round((calculated.staffAllocated / finalTotalAmount) * 100)}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 伝票選択商品と割り当て状況インジケータ */}
        {targetItemIds.length > 0 && (
          <div className="flex items-center justify-between text-xs pt-1 px-1 flex-wrap gap-2 border-t border-stone-800/60">
            <span className="text-stone-400">
              伝票選択商品: <strong className="text-white">{targetItemIds.length}品目</strong> /
              作業点数合計: <strong className="text-indigo-300">{totalAssignedAllStaff}点</strong>
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              各スタッフの担当点数に自動連動中
            </span>
          </div>
        )}
      </div>
    );
  };

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
      {renderStaffSelectModal()}

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
                ※作業で使用した部品や工賃メニューを伝票に追加してください（個数は上のスタッフ欄で入力します）
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
