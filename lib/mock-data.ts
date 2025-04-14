import type { CryptoCard } from "./api/types"
import CardLogo from "@/public/bloomLogo.jpg"
// Генерация 16 карточек для сетки 4x4
export const generateMockCards = (count = 16): CryptoCard[] => {
  const baseCards = [
    {
      id: "1",
      name: "Qunatum",
      symbol: "QNTM",
      image: CardLogo.src,
      marketCap: "$58.83K",
      tokenAge: "4m17.469719829s",
      top10: "19.34%",
      devWalletHold: "0.00%",
      first70BuyersHold: "8.81%",
      insiders: "0.00%",
      whales: [
        { count: 79, amount: "1.08 SOL" },
        { count: 55, amount: "5.01 SOL" },
        { count: 13, amount: "3.08 SOL" },
      ],
      noMint: true,
      blacklist: false,
      burnt: "100%",
      top10Percentage: "9.01%",
      priceChange: "×1.2",
      socialLinks: {
        telegram: "https://t.me/qunatum",
        twitter: "https://twitter.com/qunatum",
        website: "https://qunatum.io",
      },
    },
    {
      id: "2",
      name: "Solaris",
      symbol: "SOL",
      image: CardLogo.src,
      marketCap: "$120.45K",
      tokenAge: "2d5h12m",
      top10: "22.5%",
      devWalletHold: "2.5%",
      first70BuyersHold: "12.3%",
      insiders: "1.2%",
      whales: [
        { count: 45, amount: "2.3 SOL" },
        { count: 32, amount: "4.5 SOL" },
        { count: 18, amount: "1.8 SOL" },
      ],
      noMint: true,
      blacklist: false,
      burnt: "85%",
      top10Percentage: "12.5%",
      priceChange: "×0.9",
      socialLinks: {
        telegram: "https://t.me/solaris",
        twitter: "https://twitter.com/solaris",
        website: "https://solaris.io",
      },
    },
    {
      id: "3",
      name: "Lunaris",
      symbol: "LUN",
      image: CardLogo.src,
      marketCap: "$75.2K",
      tokenAge: "1d12h45m",
      top10: "18.7%",
      devWalletHold: "1.5%",
      first70BuyersHold: "9.2%",
      insiders: "0.5%",
      whales: [
        { count: 62, amount: "1.5 SOL" },
        { count: 41, amount: "3.2 SOL" },
        { count: 23, amount: "2.1 SOL" },
      ],
      noMint: false,
      blacklist: false,
      burnt: "92%",
      top10Percentage: "10.8%",
      priceChange: "×1.5",
      socialLinks: {
        telegram: "https://t.me/lunaris",
        twitter: "https://twitter.com/lunaris",
        website: "https://lunaris.io",
      },
    },
    {
      id: "4",
      name: "Nebula",
      symbol: "NEB",
      image: CardLogo.src,
      marketCap: "$42.6K",
      tokenAge: "8h30m",
      top10: "25.1%",
      devWalletHold: "0.8%",
      first70BuyersHold: "11.5%",
      insiders: "0.2%",
      whales: [
        { count: 38, amount: "0.9 SOL" },
        { count: 27, amount: "2.7 SOL" },
        { count: 15, amount: "1.4 SOL" },
      ],
      noMint: true,
      blacklist: true,
      burnt: "78%",
      top10Percentage: "8.3%",
      priceChange: "×0.7",
      socialLinks: {
        telegram: "https://t.me/nebula",
        twitter: "https://twitter.com/nebula",
        website: "https://nebula.io",
      },
    },
    {
      id: "5",
      name: "Cosmos",
      symbol: "COS",
      image: CardLogo.src,
      marketCap: "$95.3K",
      tokenAge: "3d2h15m",
      top10: "16.9%",
      devWalletHold: "1.2%",
      first70BuyersHold: "10.7%",
      insiders: "0.9%",
      whales: [
        { count: 51, amount: "1.7 SOL" },
        { count: 36, amount: "3.9 SOL" },
        { count: 20, amount: "2.5 SOL" },
      ],
      noMint: false,
      blacklist: false,
      burnt: "88%",
      top10Percentage: "11.2%",
      priceChange: "×1.3",
      socialLinks: {
        telegram: "https://t.me/cosmos",
        twitter: "https://twitter.com/cosmos",
        website: "https://cosmos.io",
      },
    },
    {
      id: "6",
      name: "Stellar",
      symbol: "STL",
      image: CardLogo.src,
      marketCap: "$63.8K",
      tokenAge: "1d8h40m",
      top10: "21.3%",
      devWalletHold: "0.5%",
      first70BuyersHold: "9.8%",
      insiders: "0.3%",
      whales: [
        { count: 47, amount: "1.2 SOL" },
        { count: 33, amount: "2.8 SOL" },
        { count: 19, amount: "1.9 SOL" },
      ],
      noMint: true,
      blacklist: false,
      burnt: "95%",
      top10Percentage: "9.7%",
      priceChange: "×1.1",
      socialLinks: {
        telegram: "https://t.me/stellar",
        twitter: "https://twitter.com/stellar",
        website: "https://stellar.io",
      },
    },
  ]

  // Создаем массив из 16 карточек, дублируя базовые карточки с новыми ID
  const result: CryptoCard[] = []
  for (let i = 0; i < count; i++) {
    const baseCard = baseCards[i % baseCards.length]
    result.push({
      ...baseCard,
      id: `${i + 1}`,
      name: `${baseCard.name} ${Math.floor(i / baseCards.length) > 0 ? Math.floor(i / baseCards.length) + 1 : ""}`,
      priceChange: i % 2 === 0 ? `×${(1 + Math.random()).toFixed(1)}` : `×${(1 - Math.random() * 0.5).toFixed(1)}`,
    })
  }

  return result
}

// Экспортируем начальные 16 карточек
export const mockCryptoCards = generateMockCards(16)

// Функция для создания новой карточки
export const createNewCard = (): CryptoCard => {
  const names = ["NewCoin", "FreshToken", "HotCrypto", "TrendToken", "MoonShot"]
  const symbols = ["NEW", "FRSH", "HOT", "TRND", "MOON"]

  const randomIndex = Math.floor(Math.random() * names.length)

  return {
    id: `new_${Date.now()}`,
    name: names[randomIndex],
    symbol: symbols[randomIndex],
    image: CardLogo.src,
    marketCap: `$${(Math.random() * 100).toFixed(2)}K`,
    tokenAge: `${Math.floor(Math.random() * 5)}d${Math.floor(Math.random() * 24)}h${Math.floor(Math.random() * 60)}m`,
    top10: `${(Math.random() * 30).toFixed(2)}%`,
    devWalletHold: `${(Math.random() * 5).toFixed(2)}%`,
    first70BuyersHold: `${(Math.random() * 15).toFixed(2)}%`,
    insiders: `${(Math.random() * 2).toFixed(2)}%`,
    whales: [
      { count: Math.floor(Math.random() * 100), amount: `${(Math.random() * 5).toFixed(2)} SOL` },
      { count: Math.floor(Math.random() * 80), amount: `${(Math.random() * 4).toFixed(2)} SOL` },
      { count: Math.floor(Math.random() * 50), amount: `${(Math.random() * 3).toFixed(2)} SOL` },
    ],
    noMint: Math.random() > 0.5,
    blacklist: Math.random() > 0.8,
    burnt: `${(Math.random() * 100).toFixed(0)}%`,
    top10Percentage: `${(Math.random() * 20).toFixed(2)}%`,
    priceChange:
      Math.random() > 0.5 ? `×${(1 + Math.random()).toFixed(1)}` : `×${(1 - Math.random() * 0.5).toFixed(1)}`,
    socialLinks: {
      telegram: "https://t.me/newcoin",
      twitter: "https://twitter.com/newcoin",
      website: "https://newcoin.io",
    },
  }
}
