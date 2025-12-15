// Mock data for stock prices - 30 days for 5 tickers
export interface PriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsData {
  date: string;
  ticker: string;
  title: string;
  content: string;
  source: string;
}

export interface TickerInfo {
  symbol: string;
  name: string;
  sector: string;
}

export const TICKERS: TickerInfo[] = [
  { symbol: 'VNM', name: 'Vinamilk', sector: 'Thực phẩm' },
  { symbol: 'VIC', name: 'Vingroup', sector: 'Bất động sản' },
  { symbol: 'FPT', name: 'FPT Corp', sector: 'Công nghệ' },
  { symbol: 'VCB', name: 'Vietcombank', sector: 'Ngân hàng' },
  { symbol: 'HPG', name: 'Hòa Phát', sector: 'Thép' },
];

// Generate realistic price data
function generatePriceData(basePrice: number, volatility: number, days: number): PriceData[] {
  const data: PriceData[] = [];
  let currentPrice = basePrice;
  const startDate = new Date('2024-11-01');

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const change = (Math.random() - 0.48) * volatility * currentPrice;
    const open = currentPrice;
    const close = Math.max(currentPrice + change, basePrice * 0.7);
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    const volume = Math.floor(1000000 + Math.random() * 5000000);

    data.push({
      date: date.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume,
    });

    currentPrice = close;
  }

  return data;
}

// Price data for each ticker
export const PRICE_DATA: Record<string, PriceData[]> = {
  VNM: generatePriceData(75, 0.03, 40),
  VIC: generatePriceData(42, 0.04, 40),
  FPT: generatePriceData(125, 0.035, 40),
  VCB: generatePriceData(92, 0.025, 40),
  HPG: generatePriceData(26, 0.045, 40),
};

// VNIndex mock data
export const VNINDEX_DATA: PriceData[] = generatePriceData(1250, 0.015, 40);

// News data
export const NEWS_DATA: NewsData[] = [
  {
    date: '2024-11-28',
    ticker: 'VNM',
    title: 'Vinamilk công bố kết quả kinh doanh Q3 vượt kỳ vọng',
    content: 'Vinamilk ghi nhận doanh thu quý 3 tăng 8% so với cùng kỳ năm trước, lợi nhuận sau thuế đạt 2,500 tỷ đồng. Ban lãnh đạo kỳ vọng tăng trưởng tiếp tục trong Q4.',
    source: 'VnExpress',
  },
  {
    date: '2024-11-27',
    ticker: 'FPT',
    title: 'FPT ký hợp đồng AI trị giá 100 triệu USD với đối tác Nhật Bản',
    content: 'FPT Corporation vừa ký kết thỏa thuận hợp tác chiến lược với tập đoàn công nghệ hàng đầu Nhật Bản, triển khai giải pháp AI cho khối tài chính.',
    source: 'CafeF',
  },
  {
    date: '2024-11-26',
    ticker: 'VIC',
    title: 'Vingroup tái cơ cấu mảng bất động sản',
    content: 'Tập đoàn Vingroup thông báo kế hoạch tái cơ cấu các công ty con trong lĩnh vực bất động sản nhằm tối ưu hóa hoạt động và giảm chi phí vận hành.',
    source: 'Người Đồng Hành',
  },
  {
    date: '2024-11-25',
    ticker: 'VCB',
    title: 'Vietcombank dẫn đầu lợi nhuận ngành ngân hàng',
    content: 'Vietcombank tiếp tục giữ vững vị trí ngân hàng có lợi nhuận cao nhất hệ thống với lợi nhuận trước thuế 9 tháng đạt hơn 30,000 tỷ đồng.',
    source: 'VnEconomy',
  },
  {
    date: '2024-11-24',
    ticker: 'HPG',
    title: 'Hòa Phát: Sản lượng thép tăng mạnh nhờ xuất khẩu',
    content: 'Tập đoàn Hòa Phát ghi nhận sản lượng thép tháng 10 tăng 15% nhờ đơn hàng xuất khẩu sang châu Âu và ASEAN. Tuy nhiên, giá thép trong nước vẫn chịu áp lực.',
    source: 'Đầu Tư',
  },
  {
    date: '2024-11-23',
    ticker: 'VNM',
    title: 'Vinamilk mở rộng thị trường Trung Đông',
    content: 'Vinamilk chính thức xuất khẩu sữa sang các nước vùng Vịnh, mở rộng danh mục sản phẩm Halal để phục vụ thị trường Hồi giáo.',
    source: 'Thanh Niên',
  },
  {
    date: '2024-11-22',
    ticker: 'FPT',
    title: 'FPT đầu tư 500 triệu USD vào data center',
    content: 'FPT công bố kế hoạch đầu tư xây dựng cụm data center quy mô lớn tại Bình Dương, phục vụ nhu cầu cloud computing và AI ngày càng tăng.',
    source: 'Tuổi Trẻ',
  },
  {
    date: '2024-11-21',
    ticker: 'VCB',
    title: 'Vietcombank nâng hạn mức tín dụng bất động sản',
    content: 'Ngân hàng TMCP Ngoại thương Việt Nam điều chỉnh tăng room tín dụng cho lĩnh vực bất động sản theo chỉ đạo của NHNN.',
    source: 'Dân Trí',
  },
  {
    date: '2024-11-20',
    ticker: 'HPG',
    title: 'Hòa Phát lo ngại về thuế chống bán phá giá từ EU',
    content: 'Hòa Phát bày tỏ quan ngại về khả năng EU áp thuế chống bán phá giá lên thép Việt Nam, có thể ảnh hưởng đến 20% doanh thu xuất khẩu.',
    source: 'VnExpress',
  },
  {
    date: '2024-11-19',
    ticker: 'VIC',
    title: 'Vinhomes ra mắt dự án Ocean Park 3 - The Crown',
    content: 'Vinhomes chính thức ra mắt phân khu mới tại Ocean Park 3 với tổng vốn đầu tư 10,000 tỷ đồng, hứa hẹn mang lại nguồn thu lớn trong năm 2025.',
    source: 'CafeF',
  },
];

// Helper function to get latest price
export function getLatestPrice(ticker: string): PriceData | null {
  const data = PRICE_DATA[ticker];
  return data ? data[data.length - 1] : null;
}

// Helper function to calculate returns
export function calculateReturns(prices: PriceData[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i].close - prices[i - 1].close) / prices[i - 1].close);
  }
  return returns;
}

// Helper function to calculate daily returns for all tickers
export function getAllReturns(): Record<string, number[]> {
  const returns: Record<string, number[]> = {};
  for (const ticker of Object.keys(PRICE_DATA)) {
    returns[ticker] = calculateReturns(PRICE_DATA[ticker]);
  }
  return returns;
}
