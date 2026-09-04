import React, { useState } from "react";
import { Product, TenantUser } from "../types";
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  Sparkles,
  Filter,
  Package,
  LayoutGrid,
  List,
  Tag,
  CheckCircle2,
  X,
} from "lucide-react";

interface Props {
  products: Product[];
  currentTenant: TenantUser;
  onAddProduct: (product: Omit<Product, "id" | "createdAt">) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
}

export const ProductCatalog: React.FC<Props> = ({
  products,
  currentTenant,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
}) => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"compact-list" | "compact-grid">("compact-list");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Form State
  const [formCategory, setFormCategory] = useState("Fashion & Clothing");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("20");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // Dynamic schema fields
  const [sizes, setSizes] = useState("M, L, XL");
  const [colors, setColors] = useState("Black, Navy, Maroon");
  const [fabric, setFabric] = useState("100% Combed Cotton");

  const [portionWeight, setPortionWeight] = useState("500g Jar");
  const [expiry, setExpiry] = useState("12 Months");
  const [dietary, setDietary] = useState("100% Halal Certified");

  const [customKey1, setCustomKey1] = useState("Warranty");
  const [customVal1, setCustomVal1] = useState("1 Year Replacement");

  const categories = ["All", ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    const matchesCat = categoryFilter === "All" || p.category === categoryFilter;
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const openAddModal = () => {
    setEditingProductId(null);
    setName("");
    setPrice("");
    setStock("20");
    setFormCategory("Fashion & Clothing");
    setDescription("");
    setImageUrl("");
    setSizes("M, L, XL");
    setColors("Black, Navy, Maroon");
    setFabric("100% Combed Cotton");
    setPortionWeight("500g Jar");
    setExpiry("12 Months");
    setDietary("100% Halal Certified");
    setCustomKey1("Warranty");
    setCustomVal1("1 Year Replacement");
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProductId(p.id);
    setName(p.name);
    setPrice(p.price.toString());
    setStock(p.stock.toString());
    setFormCategory(p.category || "Fashion & Clothing");
    setDescription(p.description || "");
    setImageUrl(p.imageUrl || "");

    const attrs = p.attributes || {};
    if (attrs.available_sizes) {
      setSizes(Array.isArray(attrs.available_sizes) ? attrs.available_sizes.join(", ") : String(attrs.available_sizes));
    }
    if (attrs.colors) {
      setColors(Array.isArray(attrs.colors) ? attrs.colors.join(", ") : String(attrs.colors));
    }
    if (attrs.fabric) {
      setFabric(String(attrs.fabric));
    }
    if (attrs.portion_weight) {
      setPortionWeight(String(attrs.portion_weight));
    }
    if (attrs.expiry_date) {
      setExpiry(String(attrs.expiry_date));
    }
    if (attrs.dietary) {
      setDietary(String(attrs.dietary));
    }

    // Custom attrs fallback
    const customEntries = Object.entries(attrs).filter(
      ([k]) => !["available_sizes", "colors", "fabric", "portion_weight", "expiry_date", "dietary"].includes(k)
    );
    if (customEntries.length > 0) {
      setCustomKey1(customEntries[0][0]);
      setCustomVal1(String(customEntries[0][1]));
    }

    setIsModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;

    let dynamicAttrs: Record<string, any> = {};

    if (formCategory === "Clothing" || formCategory.toLowerCase().includes("fashion")) {
      dynamicAttrs = {
        available_sizes: sizes.split(",").map((s) => s.trim()).filter(Boolean),
        colors: colors.split(",").map((c) => c.trim()).filter(Boolean),
        fabric: fabric.trim(),
      };
    } else if (formCategory === "Food & Gourmet" || formCategory.toLowerCase().includes("grocery")) {
      dynamicAttrs = {
        portion_weight: portionWeight.trim(),
        expiry_date: expiry.trim(),
        dietary: dietary.trim(),
      };
    } else {
      dynamicAttrs = {
        [customKey1]: customVal1,
      };
    }

    const defaultImg =
      formCategory === "Food & Gourmet"
        ? "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80"
        : "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80";

    if (editingProductId) {
      const existing = products.find((p) => p.id === editingProductId);
      onEditProduct({
        id: editingProductId,
        name: name.trim(),
        price: parseFloat(price) || 0,
        category: formCategory,
        stock: parseInt(stock, 10) || 0,
        description: description.trim(),
        imageUrl: imageUrl.trim() || existing?.imageUrl || defaultImg,
        attributes: dynamicAttrs,
        createdAt: existing?.createdAt || new Date().toISOString(),
      });
    } else {
      onAddProduct({
        name: name.trim(),
        price: parseFloat(price) || 0,
        category: formCategory,
        stock: parseInt(stock, 10) || 10,
        description: description.trim(),
        imageUrl: imageUrl.trim() || defaultImg,
        attributes: dynamicAttrs,
      });
    }

    setIsModalOpen(false);
    setEditingProductId(null);
  };

  return (
    <div
      id="product-catalog-view"
      className="w-full flex-1 flex flex-col min-h-0 p-4 sm:p-6 bg-[#F8FAFC] text-[#0F172A] overflow-y-auto custom-scrollbar pb-24"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 shrink-0">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">Product Catalog &amp; Inventory</h2>
            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
              {products.length} Items Listed
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Manage your store items, edit specifications anytime, and sync data directly with the AI live sales agent.
          </p>
        </div>

        <button
          id="btn-add-product-open"
          onClick={openAddModal}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center space-x-1.5 shadow-xs transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Product</span>
        </button>
      </div>

      {/* Control Bar: Search + Category Filter + View Toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-[#FFFFFF] border border-[#E2E8F0] p-2.5 sm:p-3 rounded-xl mb-4 shadow-xs shrink-0">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            id="input-product-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, specs, fabric, or category..."
            className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-blue-600 focus:bg-[#FFFFFF] transition-colors"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Category Filter */}
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-[#64748B]" />
            <select
              id="select-category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] font-medium focus:outline-none focus:border-blue-600 transition-colors cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "All" ? "All Categories" : c}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-lg border border-[#CBD5E1]">
            <button
              onClick={() => setViewMode("compact-list")}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center space-x-1 transition-all cursor-pointer ${
                viewMode === "compact-list"
                  ? "bg-[#FFFFFF] text-blue-700 shadow-xs font-semibold"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
              title="Compact Dense List View (কমপ্যাক্ট তালিকা)"
            >
              <List className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden sm:inline">Compact List</span>
            </button>
            <button
              onClick={() => setViewMode("compact-grid")}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center space-x-1 transition-all cursor-pointer ${
                viewMode === "compact-grid"
                  ? "bg-[#FFFFFF] text-blue-700 shadow-xs font-semibold"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
              title="Compact Cards View (কমপ্যাক্ট কার্ড ভিউ)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden sm:inline">Compact Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredProducts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10 bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl text-center shadow-xs">
          <Package className="w-9 h-9 text-[#94A3B8] mb-2" />
          <h3 className="text-sm font-bold text-[#0F172A]">No products match your criteria</h3>
          <p className="text-xs text-[#64748B] mt-1 max-w-sm">
            Add new catalog items or clear your search query to see inventory.
          </p>
          <button
            onClick={openAddModal}
            className="mt-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            + Add First Product
          </button>
        </div>
      ) : viewMode === "compact-list" ? (
        /* Dense Compact List / Table View - Fits dozens of products easily */
        <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs">
          <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold text-[#475569] uppercase tracking-wider items-center">
            <div className="col-span-1">Photo</div>
            <div className="col-span-4">Product Name &amp; Category</div>
            <div className="col-span-3">Brief Description &amp; Specs</div>
            <div className="col-span-2 text-right">Price &amp; Stock</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          <div className="divide-y divide-[#E2E8F0]">
            {filteredProducts.map((p) => {
              const attrs = p.attributes || {};
              const attrText = Object.entries(attrs)
                .map(([k, v]) => `${k.replace(/_/g, " ")}: ${Array.isArray(v) ? v.join("/") : v}`)
                .slice(0, 2)
                .join(" • ");

              return (
                <div
                  key={p.id}
                  className="p-3 sm:px-4 hover:bg-[#F8FAFC] transition-colors flex flex-col md:grid md:grid-cols-12 gap-3 items-start md:items-center"
                >
                  {/* Small Photo */}
                  <div className="col-span-1 flex items-center space-x-2.5">
                    <img
                      src={p.imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80"}
                      alt={p.name}
                      className="w-12 h-12 rounded-lg object-cover border border-[#CBD5E1] bg-[#F1F5F9] shrink-0"
                    />
                  </div>

                  {/* Title & Category */}
                  <div className="col-span-4 min-w-0 pr-2">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-bold text-[#0F172A] truncate" title={p.name}>
                        {p.name}
                      </h4>
                    </div>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                        {p.category}
                      </span>
                      <span className="text-[10px] text-[#94A3B8] font-mono">ID: {p.id}</span>
                    </div>
                  </div>

                  {/* Brief Light Description + Attributes */}
                  <div className="col-span-3 min-w-0 text-xs">
                    <p className="text-[11px] text-[#475569] truncate" title={p.description}>
                      {p.description || "Standard inventory catalog item."}
                    </p>
                    {attrText && (
                      <p className="text-[10px] text-[#64748B] font-mono truncate mt-0.5" title={attrText}>
                        {attrText}
                      </p>
                    )}
                  </div>

                  {/* Price & Stock */}
                  <div className="col-span-2 md:text-right flex md:flex-col items-center md:items-end justify-between w-full md:w-auto">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      {p.price} BDT
                    </span>
                    <span className="text-[10px] text-[#64748B] font-medium mt-0.5">
                      Stock: <span className="text-[#0F172A] font-semibold">{p.stock}</span>
                    </span>
                  </div>

                  {/* Actions: Edit & Delete */}
                  <div className="col-span-2 flex items-center justify-end space-x-1.5 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-[#F1F5F9]">
                    <button
                      id={`btn-edit-${p.id}`}
                      onClick={() => openEditModal(p)}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                      title="Edit product info, price, specs and attributes"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      id={`btn-delete-${p.id}`}
                      onClick={() => onDeleteProduct(p.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 p-1 rounded-md transition-colors cursor-pointer"
                      title="Delete from catalog"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Compact Grid View: Space-saving slim cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredProducts.map((p) => {
            const attrs = p.attributes || {};
            return (
              <div
                key={p.id}
                className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-3 shadow-xs hover:border-[#CBD5E1] hover:shadow-sm transition-all flex flex-col justify-between"
              >
                {/* Upper: Thumbnail + Name + Price */}
                <div>
                  <div className="flex items-start space-x-2.5 mb-2">
                    <img
                      src={p.imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80"}
                      alt={p.name}
                      className="w-14 h-14 rounded-lg object-cover border border-[#CBD5E1] bg-[#F1F5F9] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded truncate">
                          {p.category}
                        </span>
                        <span className="text-[11px] font-bold text-emerald-700 shrink-0">
                          {p.price} BDT
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-[#0F172A] line-clamp-1 mt-1" title={p.name}>
                        {p.name}
                      </h4>
                      <p className="text-[10px] text-[#64748B] line-clamp-1 mt-0.5" title={p.description}>
                        {p.description || "Catalog item"}
                      </p>
                    </div>
                  </div>

                  {/* Attributes snippet */}
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-2 py-1 mb-2 text-[10px] text-[#475569] truncate">
                    {Object.entries(attrs)
                      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${Array.isArray(v) ? v.join("/") : v}`)
                      .slice(0, 2)
                      .join(" • ") || "Ready for AI Sales"}
                  </div>
                </div>

                {/* Bottom Row: Stock + Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-[#F1F5F9] text-xs">
                  <span className="text-[10px] text-[#64748B]">
                    Stock: <span className="text-[#0F172A] font-semibold">{p.stock}</span>
                  </span>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => openEditModal(p)}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => onDeleteProduct(p.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Product SKU Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-2xl w-full max-w-lg max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-[#0F172A] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  {editingProductId ? <Edit3 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                </div>
                <h3 className="font-bold text-sm text-[#0F172A]">
                  {editingProductId ? "Edit Product SKU & Specs" : "Add New Product SKU"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProduct} className="p-5 overflow-y-auto custom-scrollbar space-y-3.5 text-xs">
              <div>
                <label className="block text-[#334155] font-semibold mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Handcrafted Cotton Casual Shirt"
                  className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-blue-600 transition-colors shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#334155] font-semibold mb-1">Price (BDT) *</label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="1650"
                    className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-blue-600 transition-colors shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-[#334155] font-semibold mb-1">Stock Units</label>
                  <input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="25"
                    className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-blue-600 transition-colors shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#334155] font-semibold mb-1">Product Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#0F172A] focus:outline-none focus:border-blue-600 transition-colors cursor-pointer shadow-xs"
                >
                  <option value="Fashion & Clothing">Fashion &amp; Clothing (Sizes, Colors, Fabric)</option>
                  <option value="Food & Gourmet">Food &amp; Groceries (Weight, Expiry, Dietary)</option>
                  <option value="Electronics & Gadgets">Electronics &amp; Gadgets (Warranty, Specs)</option>
                  <option value="Cosmetics & Skincare">Cosmetics, Beauty &amp; Skincare</option>
                  <option value="Home & Living">Home, Kitchen &amp; Decor</option>
                  <option value="General Retail">General Merchandise &amp; Other Items</option>
                </select>
              </div>

              {/* Dynamic Specs Section */}
              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2.5">
                <div className="flex items-center space-x-1.5 text-blue-700 font-bold text-[11px]">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Dynamic AI Attributes ({formCategory})</span>
                </div>

                {formCategory === "Clothing" ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[#64748B] font-medium mb-0.5 text-[11px]">Sizes (comma separated)</label>
                        <input
                          type="text"
                          value={sizes}
                          onChange={(e) => setSizes(e.target.value)}
                          placeholder="M, L, XL, XXL"
                          className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-md px-2.5 py-1.5 text-[#0F172A] focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[#64748B] font-medium mb-0.5 text-[11px]">Colors</label>
                        <input
                          type="text"
                          value={colors}
                          onChange={(e) => setColors(e.target.value)}
                          placeholder="Sky Blue, White, Black"
                          className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-md px-2.5 py-1.5 text-[#0F172A] focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[#64748B] font-medium mb-0.5 text-[11px]">Fabric &amp; Material</label>
                      <input
                        type="text"
                        value={fabric}
                        onChange={(e) => setFabric(e.target.value)}
                        placeholder="100% Breathable Cotton"
                        className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-md px-2.5 py-1.5 text-[#0F172A] focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </>
                ) : formCategory === "Food & Gourmet" ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[#64748B] font-medium mb-0.5 text-[11px]">Net Weight / Portion</label>
                        <input
                          type="text"
                          value={portionWeight}
                          onChange={(e) => setPortionWeight(e.target.value)}
                          placeholder="350g or 500g Jar"
                          className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-md px-2.5 py-1.5 text-[#0F172A] focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[#64748B] font-medium mb-0.5 text-[11px]">Shelf Life / Expiry</label>
                        <input
                          type="text"
                          value={expiry}
                          onChange={(e) => setExpiry(e.target.value)}
                          placeholder="12 Months / Same Day"
                          className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-md px-2.5 py-1.5 text-[#0F172A] focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[#64748B] font-medium mb-0.5 text-[11px]">Dietary Certification</label>
                      <input
                        type="text"
                        value={dietary}
                        onChange={(e) => setDietary(e.target.value)}
                        placeholder="100% Halal, Organic"
                        className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-md px-2.5 py-1.5 text-[#0F172A] focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[#64748B] font-medium mb-0.5 text-[11px]">Attribute Name</label>
                      <input
                        type="text"
                        value={customKey1}
                        onChange={(e) => setCustomKey1(e.target.value)}
                        className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-md px-2.5 py-1.5 text-[#0F172A] focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[#64748B] font-medium mb-0.5 text-[11px]">Value</label>
                      <input
                        type="text"
                        value={customVal1}
                        onChange={(e) => setCustomVal1(e.target.value)}
                        className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-md px-2.5 py-1.5 text-[#0F172A] focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-[#334155] font-semibold mb-1">Brief Description (ডেসক্রিপশন)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description for sales AI to use when replying..."
                  className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-blue-600 transition-colors shadow-xs"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-[#334155] font-semibold mb-1">Photo Image URL</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-blue-600 transition-colors shadow-xs"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-[#64748B] hover:text-[#0F172A] font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-product-form"
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-1.5 rounded-lg shadow-xs cursor-pointer transition-all flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{editingProductId ? "Update Product (আপডেট করুন)" : "Save Product (যুক্ত করুন)"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
