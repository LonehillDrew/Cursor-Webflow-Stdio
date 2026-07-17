/**
 * NEW FLOW data — transcribed verbatim from source-md/new-flow.mmd.
 * Do not alter labels or connections without updating the source .mmd first.
 * Each node carries a "section" used by the sidebar filter/group controls.
 * Dashed/labelled edges from the source (-.-> with a label) are preserved
 * with dashed:true and their exact label text.
 */
window.TANDEM_NEW_FLOW = {
  title: "New Flow — Proposed tandem.co.za structure",
  sourceFile: "source-md/new-flow.mmd",

  sections: [
    { id: "home", label: "Home", colour: "#4a7c59" },
    { id: "shop", label: "Shop / Categories", colour: "#5b8a6b" },
    { id: "discovery", label: "Product Discovery (PLP / PDP)", colour: "#c9922f" },
    { id: "funnel", label: "Purchase Funnel", colour: "#d9a63e" },
    { id: "account", label: "Account & Loyalty", colour: "#3f6b4c" },
    { id: "support", label: "Support & Resources", colour: "#8a6d3b" },
    { id: "dealers", label: "Find a Dealer", colour: "#5c7a99" },
    { id: "about", label: "About", colour: "#7a5c99" }
  ],

  nodes: [
    { id: "Home", label: "🏠 Home\nHero + best sellers + trust bar", section: "home" },

    { id: "Shop", label: "🛒 Shop\n(mega-menu by category)", section: "shop" },
    { id: "Dealers", label: "📍 Find a Dealer", section: "dealers" },
    { id: "Support", label: "🛠 Support & Resources", section: "support" },
    { id: "About", label: "ℹ️ About Tandem", section: "about" },
    { id: "Account", label: "👤 Account / Login", section: "account" },

    { id: "C1", label: "Lawnmowers", section: "shop" },
    { id: "C2", label: "Trimmers & Brushcutters", section: "shop" },
    { id: "C3", label: "Chainsaws", section: "shop" },
    { id: "C4", label: "Blowers & Shredders", section: "shop" },
    { id: "C5", label: "Pressure Washers & Pumps", section: "shop" },
    { id: "C6", label: "Generators", section: "shop" },
    { id: "C7", label: "Parts & Accessories", section: "shop" },

    { id: "PLP", label: "Product Listing Page\n(filterable grid)", section: "discovery" },
    { id: "Tags", label: "🏷 Facets\nPower: Petrol / Electric / Battery\nShaft: Vertical / Horizontal\nUse: Domestic / Commercial\nBrand: Tandem / Wolf / Grasshopper\nEngine: Torx / Honda / B&S\nPrice range", section: "discovery" },
    { id: "PDP", label: "Product Detail Page\nspecs, engine info, safety notes,\nrelated parts, reviews", section: "discovery" },

    { id: "AddCart", label: "Add to Cart", section: "funnel" },
    { id: "DealerCTA", label: "Check Availability\nat Dealer", section: "funnel" },
    { id: "Cart", label: "🛍 Cart", section: "funnel" },
    { id: "Checkout", label: "Checkout\n(guest or account)", section: "funnel" },
    { id: "Confirm", label: "Order Confirmation", section: "funnel" },
    { id: "AutoReg", label: "Auto: Product registered\n+ warranty logged", section: "funnel" },

    { id: "Orders", label: "Order History", section: "account" },
    { id: "Warranty", label: "Warranty & Service Reminders", section: "account" },
    { id: "Loyalty", label: "Loyalty Points & Vouchers", section: "account" },
    { id: "Forum", label: "Lawn Club Forum", section: "account" },

    { id: "SafetyInfo", label: "Safety Guidelines", section: "support" },
    { id: "EngineInfo", label: "Engine & Shaft Guide\n(Torx / Vertical vs Horizontal explained)", section: "support" },
    { id: "FAQ", label: "FAQs / Manuals / Parts Lookup", section: "support" },
    { id: "Contact", label: "Contact / Quote Request Form", section: "support" },
    { id: "Blog", label: "The Avid Gardener\n(tips, tagged to matching categories)", section: "support" },

    { id: "Map", label: "Outlet Map\nSA + Namibia, Lesotho, Swaziland,\nZambia, Zimbabwe, Mauritius", section: "dealers" },

    { id: "Story", label: "Company Story / Factory / Manufacturing", section: "about" },
    { id: "Partners", label: "Partner Brands\n(Torx, Stiga, Grasshopper, Honda)", section: "about" }
  ],

  // [from, to, options] — options.dashed + options.label preserve the
  // source's "-. label .->" dotted/labelled edges exactly.
  edges: [
    ["Home", "Shop"],
    ["Home", "Dealers"],
    ["Home", "Support"],
    ["Home", "About"],
    ["Home", "Account"],

    ["Shop", "C1"], ["Shop", "C2"], ["Shop", "C3"], ["Shop", "C4"],
    ["Shop", "C5"], ["Shop", "C6"], ["Shop", "C7"],

    ["C1", "PLP"], ["C2", "PLP"], ["C3", "PLP"], ["C4", "PLP"],
    ["C5", "PLP"], ["C6", "PLP"], ["C7", "PLP"],

    ["PLP", "Tags", { dashed: true, label: "filter by tags" }],
    ["PLP", "PDP"],

    ["PDP", "AddCart"],
    ["PDP", "DealerCTA", { dashed: true, label: "no online price/stock" }],
    ["DealerCTA", "Dealers"],

    ["AddCart", "Cart"],
    ["Cart", "Checkout"],
    ["Checkout", "Confirm"],
    ["Confirm", "AutoReg"],
    ["AutoReg", "Account"],

    ["Account", "Orders"],
    ["Account", "Warranty"],
    ["Account", "Loyalty"],
    ["Account", "Forum"],

    ["Support", "SafetyInfo"],
    ["Support", "EngineInfo"],
    ["Support", "FAQ"],
    ["Support", "Contact"],
    ["Support", "Blog"],
    ["Blog", "PLP", { dashed: true, label: "cross-sell" }],

    ["Dealers", "Map"],

    ["About", "Story"],
    ["About", "Partners"]
  ]
};
