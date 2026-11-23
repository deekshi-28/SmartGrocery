declare module 'plotly.js-dist-min' {
  export interface PlotlyHTMLElement extends HTMLElement {
    data: unknown[];
    layout: Record<string, unknown>;
    on(event: string, callback: (data: any) => void): void;
    removeAllListeners?(event: string): void;
  }

  const Plotly: {
    newPlot(
      root: HTMLElement | string,
      data: Record<string, unknown>[],
      layout?: Record<string, unknown>,
      config?: Record<string, unknown>
    ): Promise<PlotlyHTMLElement>;
    react(
      root: HTMLElement | string,
      data: Record<string, unknown>[],
      layout?: Record<string, unknown>,
      config?: Record<string, unknown>
    ): Promise<PlotlyHTMLElement>;
    purge(root: HTMLElement | string): void;
    Plots: {
      resize(root: HTMLElement | string): void;
    };
  };

  export default Plotly;
}
