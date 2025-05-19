/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/trade/TradingChart/TradingChart.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback, useLayoutEffect, useMemo } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  CandlestickData,
  HistogramData,
  LineData,
  ColorType,
  LineStyle,
  BusinessDay, // For time type checking in event handlers
  SeriesPartialOptionsMap,
} from 'lightweight-charts';
// Explicitly import series types for v5 compatibility
import { CandlestickSeries, LineSeries, HistogramSeries, LineWidth } from 'lightweight-charts';

import styles from './TradingChart.module.css';
import { useMarketContext } from '@/contexts/MarketContext';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { useWebSocket } from '@/contexts/WebsocketContext'; // Corrected casing
import type { TradingMode } from '@/lib/interfaces';
import Button from '@/components/ui/Button/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner/LoadingSpinner';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';

interface ApiKlineData {
  time: number; // UNIX timestamp (seconds)
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
  volume?: string | number;
}

const klineToCandlestick = (kline: ApiKlineData): CandlestickData => ({
    time: kline.time as UTCTimestamp,
    open: parseFloat(String(kline.open)),
    high: parseFloat(String(kline.high)),
    low: parseFloat(String(kline.low)),
    close: parseFloat(String(kline.close)),
});

const klineToLineData = (kline: ApiKlineData): LineData => ({
    time: kline.time as UTCTimestamp,
    value: parseFloat(String(kline.close)),
});

const klineToVolume = (kline: ApiKlineData, lastCandle?: CandlestickData | LineData): HistogramData => {
    let barColor = 'rgba(134, 144, 162, 0.2)'; // Dimmer neutral default for volume
    if (lastCandle) {
        const openPrice = 'open' in lastCandle ? lastCandle.open : ('value' in lastCandle ? (lastCandle as any)._internal_prevCloseForColoring || lastCandle.value : 0);
        const closePrice = 'close' in lastCandle ? lastCandle.close : lastCandle.value;
        if (openPrice < closePrice) barColor = 'rgba(0, 199, 139, 0.2)'; // Dimmer green
        else if (openPrice > closePrice) barColor = 'rgba(255, 82, 82, 0.2)'; // Dimmer red
    }
    return {
        time: kline.time as UTCTimestamp,
        value: parseFloat(String(kline.volume)) || 0,
        color: barColor,
    };
};

const getIntervalSeconds = (interval: string): number => {
    const unit = interval.slice(-1);
    const value = parseInt(interval.slice(0, -1));
    if (isNaN(value)) return 60 * 60;
    switch (unit) {
        case 'm': return value * 60;
        case 'h': return value * 60 * 60;
        case 'd': return value * 24 * 60 * 60;
        case 'w': return value * 7 * 24 * 60 * 60;
        default: return 60 * 60;
    }
};

type ChartMainSeriesType = "Candlestick" | "Line";

const TradingChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<ChartMainSeriesType> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const { activeInstrumentSymbol } = useMarketContext();
  const { currentMode } = useTradingMode();
  const { marketSpecificData, connectionStatus: wsStatus } = useWebSocket();

  const [isLoading, setIsLoading] = useState(false);
  const [currentInterval, setCurrentInterval] = useState("1h");
  const [currentChartType, setCurrentChartType] = useState<ChartMainSeriesType>("Candlestick");

  const chartOptions = useMemo(() => ({
    layout: {
        background: { type: ColorType.Solid, color: '#171b26' },
        textColor: '#d1d4dc',
        fontFamily: 'inherit',
    },
    grid: {
        vertLines: { color: '#232731', style: LineStyle.Solid },
        horzLines: { color: '#232731', style: LineStyle.Solid },
    },
    crosshair: {
        mode: 0, // CrosshairMode.Normal
        vertLine: { 
          color: '#758696', 
          style: LineStyle.Dashed, 
          width: 1 as LineWidth, // <--- Update this line
          labelBackgroundColor: '#3e4556', 
          labelTextColor: '#d1d4dc' 
        },
        horzLine: { 
          color: '#758696', 
          style: LineStyle.Dashed, 
          width: 1 as LineWidth, // <--- Update this line
          labelBackgroundColor: '#3e4556', 
          labelTextColor: '#d1d4dc' 
        },
      },      
    rightPriceScale: { borderColor: '#2a2f3b', entireTextOnly: true },
    timeScale: {
        borderColor: '#2a2f3b',
        timeVisible: true,
        secondsVisible: ["1m", "5m", "15m"].includes(currentInterval),
        rightOffset: 10, // More space on the right for future bars
        barSpacing: 8,   // Adjust bar spacing
    },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
    handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: {time: true, price: true}, axisDoubleClickReset: true },
  }), [currentInterval]); // currentInterval affects secondsVisible

  const candlestickSeriesOptions: SeriesPartialOptionsMap["Candlestick"] = useMemo(() => ({
    upColor: '#00c78b', downColor: '#ff5a5a',
    borderDownColor: '#ff5a5a', borderUpColor: '#00c78b',
    wickDownColor: 'rgba(255, 82, 82, 0.7)', wickUpColor: 'rgba(0, 199, 139, 0.7)',
    borderVisible: false,
  }), []);

  const lineSeriesOptions: SeriesPartialOptionsMap["Line"] = useMemo(() => ({
    color: '#448aff', // Brighter blue
    lineWidth: 2,
  }), []);

  const volumeSeriesOptions: SeriesPartialOptionsMap["Histogram"] = useMemo(() => ({
    priceFormat: { type: 'volume' },
    priceScaleId: 'volume', 
    scaleMargins: { top: 0.75, bottom: 0 },
    thinBars: false, // Slightly thicker bars
    // Color for volume bars will be set per bar based on candle direction
  }), []);

  const fetchChartData = useCallback(async (symbol: string, mode: TradingMode, interval: string, abortSignal?: AbortSignal) => {
    // ... (fetchChartData remains largely the same as corrected before, ensure it returns ApiKlineData[])
    if (!symbol || !mode || !interval) return [];
    setIsLoading(true);
    try {
      const limit = interval === '1d' || interval === '1w' || interval === '1M' ? 365 : 500;
      const params = new URLSearchParams({ market: symbol, mode, interval, limit: String(limit) });
      const response = await fetch(`/api/klines?${params.toString()}`, { signal: abortSignal });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({error: "Failed to parse error response"}));
        throw new Error(errData.error || `API error: ${response.status}`);
      }
      const data: ApiKlineData[] = await response.json();
      return data;
    } catch (error: any) {
      if (error.name === 'AbortError') { console.log('Chart data fetch aborted'); return []; }
      console.error("Error fetching chart data:", error);
      notify.error(error.message || "Error loading chart data.");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize and re-initialize chart
  useLayoutEffect(() => {
    if (!chartContainerRef.current) return;
    
    if (chartApiRef.current) {
        chartApiRef.current.remove();
        chartApiRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, chartOptions);
    chartApiRef.current = chart;

    if (currentChartType === "Candlestick") {
      mainSeriesRef.current = chart.addSeries(CandlestickSeries, candlestickSeriesOptions);
    } else {
      mainSeriesRef.current = chart.addSeries(LineSeries, lineSeriesOptions);
    }
    volumeSeriesRef.current = chart.addSeries(HistogramSeries, volumeSeriesOptions);
    chart.priceScale('volume').applyOptions({ visible: false }); // Hide volume axis labels

    const abortController = new AbortController();
    if (activeInstrumentSymbol && currentMode) {
        fetchChartData(activeInstrumentSymbol, currentMode, currentInterval, abortController.signal).then(apiData => {
            if (apiData && mainSeriesRef.current && volumeSeriesRef.current && !abortController.signal.aborted) {
                const mainData = currentChartType === "Candlestick" ? apiData.map(klineToCandlestick) : apiData.map(klineToLineData);
                mainSeriesRef.current.setData(mainData);
                volumeSeriesRef.current.setData(apiData.map(k => klineToVolume(k, mainData.find(md => md.time === k.time as UTCTimestamp) as CandlestickData | LineData)));
                chartApiRef.current?.timeScale().fitContent();
            }
        });
    }

    const handleResize = () => {
        if (chartApiRef.current && chartContainerRef.current) {
            chartApiRef.current.resize(chartContainerRef.current.clientWidth, chartContainerRef.current.clientHeight);
        }
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      abortController.abort();
      window.removeEventListener('resize', handleResize);
      if (chartApiRef.current) {
        chartApiRef.current.remove();
        chartApiRef.current = null;
      }
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [chartOptions, currentChartType, activeInstrumentSymbol, currentMode, currentInterval, fetchChartData, candlestickSeriesOptions, lineSeriesOptions, volumeSeriesOptions]); // Added missing dependencies


  // Fetch new historical data ONLY if activeInstrumentSymbol or interval changes (chart type change handled by re-creation)
  useEffect(() => {
    if (activeInstrumentSymbol && currentMode && currentInterval && mainSeriesRef.current && volumeSeriesRef.current && chartApiRef.current) {
        // This effect is now primarily for re-fetching when interval or symbol changes AFTER initial setup.
        // The useLayoutEffect handles the very first load and chart type changes.
        const abortController = new AbortController();
        fetchChartData(activeInstrumentSymbol, currentMode, currentInterval, abortController.signal).then(apiData => {
            if (apiData && !abortController.signal.aborted && mainSeriesRef.current && volumeSeriesRef.current) {
                const mainData = currentChartType === "Candlestick" ? apiData.map(klineToCandlestick) : apiData.map(klineToLineData);
                mainSeriesRef.current.setData(mainData);
                volumeSeriesRef.current.setData(apiData.map(k => klineToVolume(k, mainData.find(md => md.time === k.time as UTCTimestamp) as CandlestickData | LineData)));
            }
        });
        return () => abortController.abort();
    } else if (!activeInstrumentSymbol && mainSeriesRef.current && volumeSeriesRef.current) {
        mainSeriesRef.current.setData([]);
        volumeSeriesRef.current.setData([]);
    }
  // currentChartType is removed from deps here, as its change triggers chart re-creation which includes data load
  }, [activeInstrumentSymbol, currentMode, currentInterval, fetchChartData, currentChartType]);


  // Handle live trade updates from WebSocket
  useEffect(() => {
    if (wsStatus === 'OPEN' && mainSeriesRef.current && volumeSeriesRef.current && marketSpecificData.lastTrade) {
      const trade = marketSpecificData.lastTrade;
      if (trade.market === activeInstrumentSymbol && trade.mode === currentMode) {
        const tradeTimeSec = Math.floor(trade.timestamp / 1000) as UTCTimestamp;
        const intervalSec = getIntervalSeconds(currentInterval);
        
        const seriesData = mainSeriesRef.current.data(); // This gets all data points
        const lastBar = seriesData.length > 0 ? seriesData[seriesData.length - 1] : null;

        let lastBarTime: number | undefined;
        if (lastBar && lastBar.time) {
            // Check if time is BusinessDay object or UTCTimestamp number
            if (typeof lastBar.time === 'object' && 'year' in lastBar.time && 'month' in lastBar.time && 'day' in lastBar.time) {
                // It's a BusinessDay object, convert to a comparable timestamp (e.g., start of day UTC)
                // For simplicity, if using BusinessDay with live updates, ensure consistency or convert all to UTCTimestamp
                // Our API returns UTCTimestamp, so this branch is less likely for `lastBar.time`.
                const bd = lastBar.time as BusinessDay;
                lastBarTime = Date.UTC(bd.year, bd.month - 1, bd.day) / 1000;
            } else {
                lastBarTime = lastBar.time as UTCTimestamp;
            }
        }

        if (lastBarTime !== undefined) {
            let newOrUpdatedBar: CandlestickData | LineData | null = null;
            let newVolumeBar: HistogramData | null = null;

            if (tradeTimeSec >= lastBarTime && tradeTimeSec < lastBarTime + intervalSec) {
                if (currentChartType === "Candlestick" && 'open' in lastBar!) {
                    const candle = lastBar as CandlestickData;
                    newOrUpdatedBar = { time: candle.time, open: candle.open, high: Math.max(candle.high, trade.price), low: Math.min(candle.low, trade.price), close: trade.price };
                } else if (currentChartType === "Line" && 'value' in lastBar!) {
                    newOrUpdatedBar = { time: lastBar!.time, value: trade.price };
                }
                
                const volData = volumeSeriesRef.current.data();
                const lastVolBar = volData.length > 0 ? volData[volData.length - 1] as HistogramData : null;
                if (lastVolBar && lastVolBar.time === lastBarTime) { // Ensure volume bar time matches main series bar time
                    const currentOpen = newOrUpdatedBar && 'open' in newOrUpdatedBar ? newOrUpdatedBar.open : ('value' in (newOrUpdatedBar || {}) ? (newOrUpdatedBar as LineData).value : 0);
                    const currentClose = newOrUpdatedBar && 'close' in newOrUpdatedBar ? newOrUpdatedBar.close : ('value' in (newOrUpdatedBar || {}) ? (newOrUpdatedBar as LineData).value : 0);
                    newVolumeBar = { time: lastVolBar.time, value: (lastVolBar.value || 0) + trade.qty, color: currentOpen < currentClose ? 'rgba(0, 199, 139, 0.4)' : 'rgba(255, 82, 82, 0.4)' };
                }
            } else if (tradeTimeSec >= lastBarTime + intervalSec) {
                const newBarStartTime = (lastBarTime - (lastBarTime % intervalSec) + intervalSec) as UTCTimestamp;
                if (currentChartType === "Candlestick") {
                    newOrUpdatedBar = { time: newBarStartTime, open: trade.price, high: trade.price, low: trade.price, close: trade.price };
                } else {
                    newOrUpdatedBar = { time: newBarStartTime, value: trade.price };
                }
                newVolumeBar = { time: newBarStartTime, value: trade.qty, color: 'rgba(134, 144, 162, 0.4)'};
            }

            if (newOrUpdatedBar) mainSeriesRef.current.update(newOrUpdatedBar);
            if (newVolumeBar) volumeSeriesRef.current.update(newVolumeBar);

        } else if (seriesData.length === 0 && tradeTimeSec > 0) { // First data point for the chart
            const klineStartTimeForTrade = (tradeTimeSec - (tradeTimeSec % intervalSec)) as UTCTimestamp;
            let firstBar: CandlestickData | LineData;
            if (currentChartType === "Candlestick") {
                 firstBar = { time: klineStartTimeForTrade, open: trade.price, high: trade.price, low: trade.price, close: trade.price };
            } else {
                 firstBar = { time: klineStartTimeForTrade, value: trade.price };
            }
            mainSeriesRef.current.update(firstBar);
            volumeSeriesRef.current.update({ time: klineStartTimeForTrade, value: trade.qty, color: 'rgba(134, 144, 162, 0.4)'});
        }
      }
    }
  }, [marketSpecificData.lastTrade, wsStatus, activeInstrumentSymbol, currentMode, currentInterval, currentChartType]);


  const handleIntervalChange = (newInterval: string) => {
    setCurrentInterval(newInterval);
  };
  
  const handleChartTypeChange = (newType: ChartMainSeriesType) => {
    if (currentChartType === newType || !chartApiRef.current) return;
    // The useLayoutEffect for chartOptions/currentChartType will handle re-creation and data load
    setCurrentChartType(newType);
  };

  return (
    <div className={styles.chartContainerWrapper}>
      <div className={styles.chartToolbar}>
        <div className={styles.intervalSelector}>
          {["1m", "5m", "15m", "1h", "4h", "1d", "1w"].map(interval => (
            <Button key={interval} variant={currentInterval === interval ? "secondary" : "ghost"} size="sm"
              onClick={() => handleIntervalChange(interval)} className={styles.toolbarButton} >
              {interval.toUpperCase()}
            </Button>
          ))}
        </div>
         <div className={styles.chartTypeSelector}>
            <Button variant={currentChartType === 'Candlestick' ? "secondary" : "ghost"} size="sm" onClick={() => handleChartTypeChange("Candlestick")} className={styles.toolbarButton}>Candles</Button>
            <Button variant={currentChartType === 'Line' ? "secondary" : "ghost"} size="sm" onClick={() => handleChartTypeChange("Line")} className={styles.toolbarButton}>Line</Button>
        </div>
      </div>
      <div ref={chartContainerRef} className={styles.chartContainer} style={{height: `calc(100% - ${(chartContainerRef.current?.previousElementSibling as HTMLElement)?.offsetHeight || 36}px)`}}>
        {isLoading && <div className={styles.loadingOverlay}><LoadingSpinner size={32}/> <p>Loading Chart...</p></div>}
        {!activeInstrumentSymbol && !isLoading && <div className={styles.noMarketMessage}>Select an instrument to view chart.</div>}
      </div>
    </div>
  );
};

export default TradingChart;