'use client';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

// Dynamically import the ReactApexChart component for client-side rendering
const ReactApexChart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
});

interface DoughnutChartProps {
  labels: string[];
  series: number[];
  colors?: string[];
  height?: number;
}

export default function DoughnutChart({
  labels,
  series,
  colors = ['#4F8CFF', '#FFC542', '#FF6B6B'],
  height = 200,
}: DoughnutChartProps) {
  const options: ApexOptions = {
    chart: {
      type: 'donut',
      height,
    },
    labels,
    colors,
    legend: {
      position: 'bottom',
      fontSize: '14px',
      fontFamily: 'inherit',
    },
    dataLabels: {
      enabled: false,
    },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
        },
      },
    },
    stroke: {
      show: false,
    },
    tooltip: {
      enabled: true,
      y: {
        formatter: (val: number) => `${val}%`,
      },
    },
  };

  return (
    <div className="flex w-full flex-col items-center justify-center">
      <ReactApexChart
        options={options}
        series={series}
        type="donut"
        height={height}
      />
    </div>
  );
}
