import Markdown from "react-markdown";
import { ChatMessageType } from "../../../types/chatWidget";
import remarkGfm from "remark-gfm";
import rehypeMathjax from "rehype-mathjax";
import React, { useRef, useEffect } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

const TimeSeriesChart = ({ data }: { data: any }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const plotInstance = useRef<uPlot | null>(null);
  const parsedData = typeof data === "string" ? JSON.parse(data) : data;

  useEffect(() => {
    if (!parsedData || !chartRef.current) return;
  
    let plot: uPlot | null = null;
    let resizeObserver: ResizeObserver;
  
    const result = parsedData.result;
    const resultType = parsedData.resultType;
  
    if (!Array.isArray(result) || result.length === 0) {
      console.warn("⚠️ No 'result' array found.");
      return;
    }
  
    const labelMap = new Map();
    const xSet = new Set<number>();
    const series: any[] = [{ label: "Time" }];
  
    result.forEach((r: any, idx: number) => {
      const metric = r.metric || {};
      const label =
        Object.entries(metric)
          .filter(([k]) => k !== "__name__")
          .map(([k, v]) => `${k}=${v}`)
          .join(", ") || `Series ${idx + 1}`;
  
      series.push({ label, stroke: getRandomColor() });
  
      const yVals: number[] = [];
      const xVals: number[] = [];
  
      if (resultType === "vector" && Array.isArray(r.value)) {
        const [ts, val] = r.value;
        xVals.push(parseFloat(ts) * 1000);
        yVals.push(parseFloat(val));
      } else if (resultType === "matrix" && Array.isArray(r.values)) {
        r.values.forEach(([ts, val]: [string, string]) => {
          xVals.push(parseFloat(ts) * 1000);
          yVals.push(parseFloat(val));
        });
      }
  
      labelMap.set(label, { xVals, yVals });
      xVals.forEach((ts) => xSet.add(ts));
    });
  
    const sortedX = Array.from(xSet).sort((a, b) => a - b);
    const alignedData = [new Float64Array(sortedX)];
  
    series.slice(1).forEach((s) => {
      const { xVals, yVals } = labelMap.get(s.label);
      const yAligned = sortedX.map((ts) => {
        const i = xVals.indexOf(ts);
        return i >= 0 ? yVals[i] : NaN;
      });
      alignedData.push(new Float64Array(yAligned));
    });
  
    const createPlot = () => {
      if (!chartRef.current) return;
      const width = ((chartRef.current.clientWidth)/window.devicePixelRatio )*0.9;
      const height = (chartRef.current.clientHeight)/window.devicePixelRatio;
  
      const opts: uPlot.Options = {
        width,
        height,
        padding: [2, 2, 2, 2],
        scales: {
          x: { time: true },
          y: { auto: true },
        },
        series,
        axes: [
          { show: true, size: 20, grid: { show: true }, ticks: { show: true } },
          { show: true, size: 35, grid: { show: true }, ticks: { show: true } },
        ],
        legend: { show: false },
        cursor: {
          drag: { x: true, y: true },
          focus: { prox: 16 },
          points: { show: true, size: 5 },
          sync: { key: "timeplot", scales: ["x", "y"] },
        },
      };
  
      plot?.destroy();
      chartRef.current!.innerHTML = "";
      plot = new uPlot(opts, alignedData, chartRef.current!);
    };
  
    createPlot();
  
    resizeObserver = new ResizeObserver(() => {
      createPlot();
    });
    resizeObserver.observe(chartRef.current);
  
    return () => {
      resizeObserver.disconnect();
      plot?.destroy();
    };
  }, [data]);


  return (
    <div
      ref={chartRef}
      style={{
        width: "100%",
        height: "200px",
        overflow: "hidden",
        borderRadius: "8px",
        backgroundColor: "white",
        boxSizing: "border-box",
      }}
      className="bg-white shadow-sm border border-gray-200"
    />
  );
};

function getRandomColor() {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}

export default function ChatMessage({
  message,
  isSend,
  error,
  isPlot,
  user_message_style,
  bot_message_style,
  error_message_style,
}: ChatMessageType) {
  return (
    <div
      className={
        "cl-chat-message " + (isSend ? " cl-justify-end" : " cl-justify-start")
      }
    >
      {isSend ? (
        <div style={user_message_style} className="cl-user_message">
          {message}
        </div>
      ) : error ? (
        <div style={error_message_style} className="cl-error_message">
          {message}
        </div>
      ) : isPlot && message ? (
        <div
          style={{
            ...bot_message_style,
            position: "relative",
            width: "100%",
            height: "100%", // Adjust height as needed
            overflow: "hidden", // Prevent the chart from overflowing the bubble
          }}
          className="cl-bot_message cl-plot_message mx-auto my-2"
        >
          <TimeSeriesChart data={message} />
        </div>
      ) : (
        <div style={bot_message_style} className="cl-bot_message">
          <Markdown
            className="markdown-body prose flex flex-col word-break-break-word"
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeMathjax]}
          >
            {message}
          </Markdown>
        </div>
      )}
    </div>
  );
}
