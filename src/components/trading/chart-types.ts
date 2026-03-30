export interface ChartProps {
  className?: string;
  symbol?: string;
  onSymbolChange?: (symbol: string) => void;
  onIntervalChange?: (interval: string) => void;
}
