let PRODUCTS = [
  { id: 1, club: "Barcelona", kit: "Home 2026/27", number: 10, price: 350, sale: null, color: "#A50044", stripe: "#004D98", textColor: "#FBE122", image: "customJersey/Barca.home.front.png", backImage: "customJersey/Barca.home.back.png" },
  { id: 2, club: "Barcelona", kit: "Away 2026/27", number: 10, price: 350, sale: null, color: "#E8DCCB", stripe: "#A50044", textColor: "#FBE122", image: "customJersey/Barca.away.front.png", backImage: "customJersey/Barca.away.back.png" },
  { id: 3, club: "Barcelona", kit: "Third 2026/27", number: 10, price: 350, sale: null, color: "#17131F", stripe: "#B99A55", textColor: "#FBE122", image: "customJersey/Barca.third.front.png", backImage: "customJersey/Barca.third.back.png" },
  { id: 4, club: "Real Madrid", kit: "Home 2026/27", number: 9, price: 350, sale: null, color: "#FFFFFF", stripe: "#FEBE10", image: "customJersey/Madrid.home.front.png", backImage: "customJersey/Madrid.home.back.png" },
  { id: 5, club: "Real Madrid", kit: "Away 2026/27", number: 9, price: 350, sale: null, color: "#1B2A49", stripe: "#FEBE10", image: "customJersey/Madrid.away.front.png", backImage: "customJersey/Madrid.away.back.png" },
  { id: 6, club: "Real Madrid", kit: "Third 2026/27", number: 9, price: 350, sale: null, color: "#1B2A49", stripe: "#FEBE10", image: "customJersey/Madrid.third.front.png", backImage: "customJersey/Madrid.third.back.png" },
  { id: 7, club: "Manchester United", kit: "Home 2026/27", number: 7, price: 350, sale: null, color: "#DA291C", stripe: "#FBE122", image: "customJersey/United.home.front.png", backImage: "customJersey/United.home.back.png" },
  { id: 8, club: "Manchester United", kit: "Away 2026/27", number: 7, price: 350, sale: null, color: "#F2F2F2", stripe: "#DA291C", image: "customJersey/United.away.front.png", backImage: "customJersey/United.away.back.png" },
  { id: 9, club: "Manchester United", kit: "Third 2026/27", number: 7, price: 350, sale: null, color: "#111111", stripe: "#DA291C", image: "customJersey/United.third.front.png", backImage: "customJersey/United.third.back.png" },
  { id: 13, club: "Arsenal", kit: "Home 2026/27", number: 8, price: 350, sale: null, color: "#EF0107", stripe: "#FFFFFF", image: "customJersey/Arsenal.home.front.png", backImage: "customJersey/Arsenal.home.back.png" },
  { id: 14, club: "Arsenal", kit: "Away 2026/27", number: 8, price: 350, sale: null, color: "#F2D49B", stripe: "#EF0107", image: "customJersey/Arsenal.away.front.png", backImage: "customJersey/Arsenal.away.back.png" },
  { id: 15, club: "Arsenal", kit: "Third 2026/27", number: 8, price: 350, sale: null, color: "#111111", stripe: "#EF0107", image: "customJersey/Arsenal.third.front.png", backImage: "customJersey/Arsenal.third.back.png" },
  { id: 10, club: "Liverpool", kit: "Home 2026/27", number: 11, price: 350, sale: null, color: "#C8102E", stripe: "#00A398", image: "customJersey/Liverpool.home.front.png", backImage: "customJersey/Liverpool.home.front.png" },
  { id: 11, club: "Liverpool", kit: "Away 2026/27", available: false, number: 11, price: 350, sale: null, color: "#F2F2F2", stripe: "#C8102E", image: "customJersey/Liverpool.away.front.jpeg", backImage: "customJersey/liverpool.away.back.jpeg" },
  { id: 12, club: "Liverpool", kit: "Third 2026/27", available: false, number: 11, price: 350, sale: null, color: "#111111", stripe: "#C8102E", image: "images/Liverpool.third.jpg", backImage: "images/Liverpool.third.jpg" },
  { id: 16, club: "Chelsea", kit: "Home 2026/27", number: 17, price: 350, sale: null, color: "#034694", stripe: "#FFFFFF", image: "customJersey/Chelsea.home.front.png", backImage: "customJersey/Chelsea.home.back.png" },
  { id: 17, club: "Chelsea", kit: "Away 2026/27", number: 17, price: 350, sale: null, color: "#F2F2F2", stripe: "#034694", image: "customJersey/Chelsea.away.front.png", backImage: "customJersey/Chelsea.away.back.png" },
  { id: 18, club: "Chelsea", kit: "Third 2026/27", number: 17, price: 350, sale: null, color: "#111111", stripe: "#034694", image: "images/chelsea.third.webp", backImage: "images/chelsea.third.webp" },
  { id: 19, club: "PSG", kit: "Home 2026/27", number: 30, price: 350, sale: null, color: "#04175C", stripe: "#DA291C", image: "customJersey/Paris.home.front.png", backImage: "customJersey/Paris.home.front.png" },
  { id: 20, club: "PSG", kit: "Away 2026/27", number: 30, price: 350, sale: null, color: "#F2F2F2", stripe: "#04175C", image: "customJersey/Paris.away.front.png", backImage: "customJersey/Paris.away.back.png" },
  { id: 21, club: "PSG", kit: "Third 2026/27", available: false, number: 30, price: 350, sale: null, color: "#111111", stripe: "#DA291C", image: null, backImage: null },
  { id: 22, club: "Bayern Munich", kit: "Home 2026/27", number: 25, price: 350, sale: null, color: "#DC052D", stripe: "#0066B2", image: "customJersey/Bayern.home.front.png", backImage: "customJersey/Bayern.home.back.png" },
  { id: 23, club: "Bayern Munich", kit: "Away 2026/27", number: 25, price: 350, sale: null, color: "#111111", stripe: "#DC052D", image: "customJersey/Bayern.away.front.png", backImage: "customJersey/Bayern.away.back.png" },
  { id: 24, club: "Bayern Munich", kit: "Third 2026/27", number: 25, price: 350, sale: null, color: "#F2F2F2", stripe: "#DC052D", image: "images/Bayern.third.webp", backImage: "images/Bayern.third.webp" },
  { id: 25, club: "Manchester City", kit: "Home 2026/27", number: 9, price: 350, sale: null, color: "#6CABDD", stripe: "#FFFFFF", image: "customJersey/City.home.front.png", backImage: "customJersey/City.home.back.png" },
  { id: 26, club: "Manchester City", kit: "Away 2026/27", number: 9, price: 350, sale: null, color: "#111111", stripe: "#6CABDD", image: "images/City.away.webp", backImage: "images/City.away.webp" },
  { id: 27, club: "Manchester City", kit: "Third 2026/27", available: false, number: 9, price: 350, sale: null, color: "#F2F2F2", stripe: "#6CABDD", image: "images/City.third.webp", backImage: "images/City.third.webp" },
  { id: 28, club: "Tottenham Hotspur", kit: "Home 2026/27", number: 7, price: 350, sale: null, color: "#FFFFFF", stripe: "#132257", image: "images/Spurs.home.webp", backImage: "images/Spurs.home.webp" },
  { id: 29, club: "Tottenham Hotspur", kit: "Away 2026/27", number: 7, price: 350, sale: null, color: "#132257", stripe: "#FFFFFF", image: "images/Spurs.away.webp", backImage: "images/Spurs.away.webp" },
  { id: 30, club: "Tottenham Hotspur", kit: "Third 2026/27", number: 7, price: 350, sale: null, color: "#6CABDD", stripe: "#132257", image: "images/Spurs.third.webp", backImage: "images/Spurs.third.webp" },
  { id: 31, club: "Atletico Madrid", kit: "Home 2026/27", number: 7, price: 350, sale: null, color: "#CE3524", stripe: "#FFFFFF", image: "images/Atm.home.jpg", backImage: "images/Atm.home.jpg" },
  { id: 32, club: "Atletico Madrid", kit: "Away 2026/27", number: 7, price: 350, sale: null, color: "#1D428A", stripe: "#CE3524", image: "customJersey/Atm.away.front.png", backImage: "customJersey/Atm.away.front.png" },
  { id: 33, club: "Atletico Madrid", kit: "Third 2026/27", number: 7, price: 350, sale: null, color: "#111111", stripe: "#CE3524", image: "images/Atm.third.jpeg", backImage: "images/Atm.third.jpeg" },
  { id: 34, club: "Borussia Dortmund", kit: "Home 2026/27", number: 9, price: 350, sale: null, color: "#FDE100", stripe: "#111111", image: "images/Dortmund.home.webp", backImage: "images/Dortmund.home.webp" },
  { id: 35, club: "Borussia Dortmund", kit: "Away 2026/27", number: 9, price: 350, sale: null, color: "#111111", stripe: "#FDE100", image: "images/Dortmund.away.webp", backImage: "images/Dortmund.away.webp" },
  { id: 36, club: "Borussia Dortmund", kit: "Third 2026/27", number: 9, price: 350, sale: null, color: "#FFFFFF", stripe: "#FDE100", image: "images/Dortmund.third.jpg", backImage: "images/Dortmund.third.jpg" },
  { id: 37, club: "Juventus", kit: "Home 2026/27", number: 10, price: 350, sale: null, color: "#FFFFFF", stripe: "#111111", image: "customJersey/Juv.home.front.png", backImage: "customJersey/juv.home.back.png" },
  { id: 38, club: "Juventus", kit: "Away 2026/27", number: 10, price: 350, sale: null, color: "#111111", stripe: "#FFFFFF", image: "images/Juv.away.webp", backImage: "images/Juv.away.webp" },
  { id: 39, club: "Juventus", kit: "Third 2026/27", number: 10, price: 350, sale: null, color: "#C8A45D", stripe: "#111111", image: "images/Juv.third.jpg", backImage: "images/Juv.third.jpg" },
  { id: 40, club: "Inter Milan", kit: "Home 2026/27", number: 10, price: 350, sale: null, color: "#0068A8", stripe: "#000000", image: "customJersey/Inter.home.front.png", backImage: "customJersey/Inter.home.back.png" },
  { id: 41, club: "Inter Milan", kit: "Away 2026/27", number: 10, price: 350, sale: null, color: "#FFFFFF", stripe: "#0068A8", image: "images/Inter.away.webp", backImage: "images/Inter.away.webp" },
  { id: 42, club: "Inter Milan", kit: "Third 2026/27", number: 10, price: 350, sale: null, color: "#000000", stripe: "#00FF00", image: "images/Inter.third.webp", backImage: "images/Inter.third.webp" },
  { id: 43, club: "Al-Nassr", kit: "Home 2026/27", number: 7, price: 380, sale: null, color: "#FDE100", stripe: "#000000", image: "customJersey/AlNassr.home.front.png", backImage: "customJersey/AlNassr.home.back.png" },
  { id: 44, club: "Al-Nassr", kit: "Away 2026/27", number: 7, price: 380, sale: null, color: "#1D1D1D", stripe: "#FFFFFF", image: "customJersey/AlNassr.away.front.png", backImage: "customJersey/AlNassr.away.back.png" },
  { id: 45, club: "Al-Nassr", kit: "Third 2026/27", number: 7, price: 380, sale: null, color: "#FF0000", stripe: "#FFFFFF", image: "customJersey/AlNassr.third.front.png", backImage: "customJersey/AlNassr.third.back.png" },
  { id: 46, club: "Inter Miami", kit: "Home 2026/27", number: 10, price: 400, sale: null, color: "#F9E1E2", stripe: "#613913", image: "images/Miami.home.webp", backImage: "images/Miami.home.webp" },
  { id: 47, club: "Inter Miami", kit: "Away 2026/27", number: 10, price: 400, sale: null, color: "#613913", stripe: "#FFFFFF", image: "images/Miami.away.webp", backImage: "images/Miami.away.webp" },
  { id: 48, club: "Inter Miami", kit: "Third 2026/27", number: 10, price: 400, sale: null, color: "#000000", stripe: "#F9E1E2", image: "customJersey/Miami.third.front.png", backImage: "customJersey/Miami.third.back.png" },
];

const SIZES = ["M", "L", "XL", "XXL"];
const SIZE_GUIDE = [
  { size: "M", chest: "38-40 in", length: "28 in", recommended: "Most adults" },
  { size: "L", chest: "40-42 in", length: "29 in", recommended: "Large build" },
  { size: "XL", chest: "42-44 in", length: "30 in", recommended: "Extra large" },
  { size: "XXL", chest: "44-46 in", length: "31 in", recommended: "2XL+ build" }
];

const LEAGUE_BY_CLUB = {
  Barcelona: "La Liga",
  "Real Madrid": "La Liga",
  "Manchester United": "Premier League",
  Liverpool: "Premier League",
  Arsenal: "Premier League",
  Chelsea: "Premier League",
  "Manchester City": "Premier League",
  "Tottenham Hotspur": "Premier League",
  PSG: "Ligue 1",
  "Atletico Madrid": "La Liga",
  "Bayern Munich": "Bundesliga",
  "Borussia Dortmund": "Bundesliga",
  Juventus: "Serie A",
  "Inter Milan": "Serie A",
  "Al-Nassr": "Saudi Pro League",
  "Inter Miami": "MLS"
};

const AVAILABILITY_BY_CLUB = {
  Barcelona: "Available",
  "Real Madrid": "Available",
  "Manchester United": "Available",
  Liverpool: "Available",
  Arsenal: "Available",
  Chelsea: "Available",
  "Manchester City": "Available",
  Juventus: "Not available",
  "Borussia Dortmund": "Not available",
  "Atletico Madrid": "Not available",
  "Tottenham Hotspur": "Not available",
  "Bayern Munich": "Not available",
  PSG: "Not available",
  "Inter Milan": "Available",
  "Al-Nassr": "Available",
  "Inter Miami": "Available"
};

const ADDITIONAL_LEAGUES = ["International"];
const CURRENCY = "Le";
const TEAM_PALETTES = {
  Barcelona: { color: "#A50044", stripe: "#004D98" },
  "Real Madrid": { color: "#FFFFFF", stripe: "#FEBE10" },
  "Manchester United": { color: "#DA291C", stripe: "#FBE122" },
  Liverpool: { color: "#C8102E", stripe: "#00A398" },
  Arsenal: { color: "#EF0107", stripe: "#FFFFFF" },
  Chelsea: { color: "#034694", stripe: "#FFFFFF" },
  "Manchester City": { color: "#6CABDD", stripe: "#FFFFFF" },
  "Tottenham Hotspur": { color: "#FFFFFF", stripe: "#132257" },
  PSG: { color: "#04175C", stripe: "#DA291C" },
  "Bayern Munich": { color: "#DC052D", stripe: "#0066B2" },
  "Borussia Dortmund": { color: "#FDE100", stripe: "#111111" },
  Juventus: { color: "#FFFFFF", stripe: "#111111" },
  "Atletico Madrid": { color: "#CE3524", stripe: "#FFFFFF" },
  "Inter Milan": { color: "#0068A8", stripe: "#000000" },
  "Al-Nassr": { color: "#FDE100", stripe: "#000000" },
  "Inter Miami": { color: "#F9E1E2", stripe: "#613913" }
};

async function loadProductsFromApi() {
  try {
    const response = await fetch(`${API_BASE}/products`);
    if (!response.ok) return;
    const { products: remoteProducts } = await response.json();
    if (!Array.isArray(remoteProducts) || remoteProducts.length === 0) return;

    PRODUCTS.splice(
      0,
      PRODUCTS.length,
      ...remoteProducts.map((product) => ({
        ...product,
        backImage: product.back_image ?? product.backImage ?? null,
        textColor: product.text_color ?? product.textColor ?? null,
      })),
    );
  } catch {
    // Keep the bundled catalog available when the API cannot be reached.
  }
}

function getProductAvailability(p) {
  const kit = String(p.kit);
  if (
    ((p.club === "Barcelona" || p.club === "Real Madrid" || p.club === "Chelsea") && kit.startsWith("Third")) ||
    (p.club === "PSG" && (kit.startsWith("Home") || kit.startsWith("Away"))) ||
    (p.club === "Bayern Munich" && kit.startsWith("Home")) ||
    (p.club === "Tottenham Hotspur" && kit.startsWith("Home")) ||
    (p.club === "Atletico Madrid" && (kit.startsWith("Home") || kit.startsWith("Away"))) ||
    (p.club === "Juventus" && kit.startsWith("Home"))
  ) {
    return "Available";
  }
  if (typeof p.availability === "string") return p.availability;
  if (p.available === false) return "Not available";
  return AVAILABILITY_BY_CLUB[p.club] || "Not available";
}

function isProductAvailable(p) {
  return getProductAvailability(p) === "Available";
}

function getTeamPalette(team) {
  return TEAM_PALETTES[team] || { color: "#10233f", stripe: "#f4efe6" };
}

function getAllLeagues() {
  const leagues = new Set([...Object.values(LEAGUE_BY_CLUB), ...ADDITIONAL_LEAGUES]);
  return Array.from(leagues).sort();
}

function getTeamsByLeague(league) {
  if (league === "all") return Object.keys(LEAGUE_BY_CLUB);
  return Object.entries(LEAGUE_BY_CLUB)
    .filter(([, l]) => l === league)
    .map(([team]) => team);
}

function searchProducts(query) {
  if (!query || query.trim().length < 2) return PRODUCTS;
  const q = query.toLowerCase().trim();
  return PRODUCTS.filter(p => 
    p.club.toLowerCase().includes(q) ||
    p.kit.toLowerCase().includes(q) ||
    (LEAGUE_BY_CLUB[p.club] && LEAGUE_BY_CLUB[p.club].toLowerCase().includes(q))
  );
}
