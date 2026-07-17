/**
 * OLD FLOW data — transcribed verbatim from source-md/old-flow.mmd.
 * Do not alter labels or connections without updating the source .mmd first.
 * Each node carries a "section" used by the sidebar filter/group controls.
 */
window.TANDEM_OLD_FLOW = {
  title: "Old Flow — Current tandem.co.za structure",
  sourceFile: "source-md/old-flow.mmd",

  sections: [
    { id: "home", label: "Home", colour: "#4a7c59" },
    { id: "topnav", label: "Top Navigation", colour: "#5b8a6b" },
    { id: "products", label: "Product Categories", colour: "#7fae8c" },
    { id: "dealer", label: "Dealerships / Outlets", colour: "#3f6b4c" },
    { id: "loyalty", label: "Registration & Loyalty", colour: "#c9922f" },
    { id: "blog", label: "The Avid Gardener (Blog)", colour: "#8a6d3b" },
    { id: "contact", label: "Contact", colour: "#5c7a99" },
    { id: "partners", label: "Partner Sites (external)", colour: "#999999" }
  ],

  // node id : { label, section, external }
  nodes: [
    { id: "Home", label: "🏠 Home\ntandem.co.za", section: "home" },

    { id: "About", label: "About", section: "topnav" },
    { id: "Safety", label: "Safety", section: "topnav" },
    { id: "Dealerships", label: "Dealerships\n(Find an Outlet)", section: "dealer" },
    { id: "ProdReg", label: "Product Registration", section: "loyalty" },
    { id: "Members", label: "Members / Loyalty", section: "loyalty" },
    { id: "VShaft", label: "Vertical Shaft", section: "topnav" },
    { id: "Torx", label: "Torx\n(Engines)", section: "topnav" },
    { id: "HShaft", label: "Horizontal Shaft", section: "topnav" },
    { id: "AvidGardener", label: "The Avid Gardener\n(Blog / News)", section: "blog" },
    { id: "Login", label: "Log In / Register\n(account)", section: "topnav" },

    { id: "Products", label: "Product Categories", section: "products" },
    { id: "P1", label: "Electric Trimmers", section: "products" },
    { id: "P2", label: "Blowers", section: "products" },
    { id: "P3", label: "Electric Lawnmowers", section: "products" },
    { id: "P4", label: "Petrol Lawnmowers", section: "products" },
    { id: "P5", label: "Cylinder Lawnmowers", section: "products" },
    { id: "P6", label: "Ride-On Mowers", section: "products" },
    { id: "P7", label: "Push Mowers", section: "products" },
    { id: "P8", label: "Trimmers", section: "products" },
    { id: "P9", label: "Brushcutters", section: "products" },
    { id: "P10", label: "Chainsaws", section: "products" },
    { id: "P11", label: "High Pressure Washers", section: "products" },
    { id: "P12", label: "Pumps", section: "products" },
    { id: "P13", label: "Generators", section: "products" },
    { id: "P14", label: "Shredders", section: "products" },
    { id: "P15", label: "ZeroTurn / Grasshopper\nRide-On Mowers", section: "products" },
    { id: "ProductDetail", label: "Product Detail Page", section: "products" },

    { id: "OutletMap", label: "Outlet Map / List\n(100+ outlets: SA, Namibia, Lesotho,\nSwaziland, Zambia, Zimbabwe, Mauritius)", section: "dealer" },

    { id: "RegForm", label: "Registration Form", section: "loyalty" },
    { id: "LoyaltyPoints", label: "Loyalty Points Account", section: "loyalty" },
    { id: "Perks", label: "Service Reminders,\nWarranty Records,\nLawn Club Forum,\nDiscount Vouchers", section: "loyalty" },

    { id: "BlogList", label: "Blog Post Listing", section: "blog" },
    { id: "BlogPost", label: "Blog Post Detail", section: "blog" },
    { id: "BlogSignup", label: "Newsletter Signup", section: "blog" },

    { id: "Contact", label: "Contact Us\n(Quote Request Form)", section: "contact" },
    { id: "ContactSuccess", label: "Confirmation Message", section: "contact" },

    { id: "Partners", label: "Partner Sites (external)", section: "partners", external: true },
    { id: "Torx2", label: "torx.co.za", section: "partners", external: true },
    { id: "Stiga", label: "stiga.com", section: "partners", external: true },
    { id: "Grasshopper", label: "grasshoppermowers.com", section: "partners", external: true },
    { id: "Honda", label: "engines.honda.com", section: "partners", external: true }
  ],

  // [from, to] — plain edges. Old-flow source has no dashed/labelled edges.
  edges: [
    ["Home", "About"],
    ["Home", "Safety"],
    ["Home", "Dealerships"],
    ["Home", "ProdReg"],
    ["Home", "Members"],
    ["Home", "VShaft"],
    ["Home", "Torx"],
    ["Home", "HShaft"],
    ["Home", "AvidGardener"],
    ["Home", "Login"],
    ["Home", "Products"],

    ["Products", "P1"], ["Products", "P2"], ["Products", "P3"], ["Products", "P4"],
    ["Products", "P5"], ["Products", "P6"], ["Products", "P7"], ["Products", "P8"],
    ["Products", "P9"], ["Products", "P10"], ["Products", "P11"], ["Products", "P12"],
    ["Products", "P13"], ["Products", "P14"], ["Products", "P15"],

    ["P1", "ProductDetail"], ["P2", "ProductDetail"], ["P3", "ProductDetail"], ["P4", "ProductDetail"],
    ["P5", "ProductDetail"], ["P6", "ProductDetail"], ["P7", "ProductDetail"], ["P8", "ProductDetail"],
    ["P9", "ProductDetail"], ["P10", "ProductDetail"], ["P11", "ProductDetail"], ["P12", "ProductDetail"],
    ["P13", "ProductDetail"], ["P14", "ProductDetail"], ["P15", "ProductDetail"],

    ["ProductDetail", "Dealerships"],
    ["Dealerships", "OutletMap"],

    ["ProdReg", "RegForm"],
    ["RegForm", "LoyaltyPoints"],
    ["Members", "LoyaltyPoints"],
    ["LoyaltyPoints", "Perks"],

    ["AvidGardener", "BlogList"],
    ["BlogList", "BlogPost"],
    ["AvidGardener", "BlogSignup"],

    ["Home", "Contact"],
    ["Contact", "ContactSuccess"],

    ["Home", "Partners"],
    ["Partners", "Torx2"],
    ["Partners", "Stiga"],
    ["Partners", "Grasshopper"],
    ["Partners", "Honda"]
  ]
};
