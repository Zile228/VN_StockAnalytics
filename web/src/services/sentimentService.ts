// Rule-based sentiment analyzer for Vietnamese financial news

const POSITIVE_WORDS = [
  'tăng', 'tăng trưởng', 'lợi nhuận', 'vượt kỳ vọng', 'kỷ lục', 'thành công',
  'mở rộng', 'đầu tư', 'hợp tác', 'chiến lược', 'phát triển', 'cải thiện',
  'tích cực', 'khả quan', 'thuận lợi', 'tiềm năng', 'cơ hội', 'dẫn đầu',
  'đột phá', 'hiệu quả', 'ổn định', 'bền vững', 'tối ưu', 'cao nhất',
  'xuất khẩu', 'mạnh mẽ', 'kỳ vọng', 'triển vọng', 'hấp dẫn', 'hứa hẹn',
  'lạc quan', 'vững chắc', 'động lực', 'bứt phá', 'chất lượng'
];

const NEGATIVE_WORDS = [
  'giảm', 'sụt giảm', 'lỗ', 'thua lỗ', 'khó khăn', 'rủi ro', 'lo ngại',
  'áp lực', 'thách thức', 'biến động', 'bất ổn', 'tiêu cực', 'suy yếu',
  'chậm lại', 'đình trệ', 'cắt giảm', 'sa thải', 'phá sản', 'nợ xấu',
  'thuế', 'chống bán phá giá', 'hạn chế', 'thu hẹp', 'sụp đổ', 'khủng hoảng',
  'tái cơ cấu', 'chi phí', 'cạnh tranh', 'quan ngại', 'ảnh hưởng', 'thiệt hại'
];

export interface SentimentResult {
  score: number; // -1 to 1
  label: 'positive' | 'negative' | 'neutral';
  confidence: number; // 0 to 1
  positiveWords: string[];
  negativeWords: string[];
}

export function analyzeSentiment(text: string): SentimentResult {
  const normalizedText = text.toLowerCase();
  
  const foundPositive: string[] = [];
  const foundNegative: string[] = [];
  
  // Count positive words
  for (const word of POSITIVE_WORDS) {
    if (normalizedText.includes(word)) {
      foundPositive.push(word);
    }
  }
  
  // Count negative words
  for (const word of NEGATIVE_WORDS) {
    if (normalizedText.includes(word)) {
      foundNegative.push(word);
    }
  }
  
  const positiveCount = foundPositive.length;
  const negativeCount = foundNegative.length;
  const totalCount = positiveCount + negativeCount;
  
  // Calculate score
  let score = 0;
  if (totalCount > 0) {
    score = (positiveCount - negativeCount) / totalCount;
  }
  
  // Determine label
  let label: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (score > 0.2) label = 'positive';
  else if (score < -0.2) label = 'negative';
  
  // Calculate confidence based on total words found
  const confidence = Math.min(totalCount / 5, 1);
  
  return {
    score: Math.round(score * 100) / 100,
    label,
    confidence: Math.round(confidence * 100) / 100,
    positiveWords: foundPositive,
    negativeWords: foundNegative,
  };
}

// Aggregate sentiment for multiple news items
export function aggregateSentiment(sentiments: SentimentResult[]): SentimentResult {
  if (sentiments.length === 0) {
    return {
      score: 0,
      label: 'neutral',
      confidence: 0,
      positiveWords: [],
      negativeWords: [],
    };
  }
  
  const avgScore = sentiments.reduce((sum, s) => sum + s.score, 0) / sentiments.length;
  const avgConfidence = sentiments.reduce((sum, s) => sum + s.confidence, 0) / sentiments.length;
  
  const allPositive = [...new Set(sentiments.flatMap(s => s.positiveWords))];
  const allNegative = [...new Set(sentiments.flatMap(s => s.negativeWords))];
  
  let label: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (avgScore > 0.2) label = 'positive';
  else if (avgScore < -0.2) label = 'negative';
  
  return {
    score: Math.round(avgScore * 100) / 100,
    label,
    confidence: Math.round(avgConfidence * 100) / 100,
    positiveWords: allPositive,
    negativeWords: allNegative,
  };
}

// Get sentiment color
export function getSentimentColor(label: 'positive' | 'negative' | 'neutral'): string {
  switch (label) {
    case 'positive':
      return 'text-success';
    case 'negative':
      return 'text-destructive';
    default:
      return 'text-muted-foreground';
  }
}

// Get sentiment badge variant
export function getSentimentBadgeVariant(label: 'positive' | 'negative' | 'neutral'): 'default' | 'destructive' | 'secondary' {
  switch (label) {
    case 'positive':
      return 'default';
    case 'negative':
      return 'destructive';
    default:
      return 'secondary';
  }
}
