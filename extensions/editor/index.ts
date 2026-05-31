import { CustomEditor } from "@earendil-works/pi-coding-agent";

import { SplitLine } from "../shared/components/split-line";
import { formatModel } from "../shared/utils/format";

import type { ExtensionAPI, ExtensionContext, KeybindingsManager } from "@earendil-works/pi-coding-agent";
import type { TUI, EditorTheme } from "@earendil-works/pi-tui";

const SPINNER_FRAMES = ["○○○○", "●○○○", "○●○○", "○○●○", "○○○●", "●●○○", "●○●○", "●○○●", "○●●○", "○●○●", "○○●●", "●●●○", "●●○●", "●○●●", "○●●●", "●●●●"];
const SPINNER_MIN_INTERVAL_MS = 120;
const SPINNER_MAX_INTERVAL_MS = 240;

interface SpinnerOptions {
	frames?: string[];
	interval?: number | { min: number; max: number };
	random?: boolean;
}

class Spinner {
	private tui: TUI | undefined;

	private frames: string[];
	private interval: number | { min: number; max: number };
	private random: boolean;

	private working: boolean = false;
	private frameIndex: number = -1;
	private timer: ReturnType<typeof setTimeout> | undefined;

	constructor(options: SpinnerOptions = {}) {
		this.frames = options.frames?.length ? options.frames : SPINNER_FRAMES;
		this.interval = options.interval ?? { min: SPINNER_MIN_INTERVAL_MS, max: SPINNER_MAX_INTERVAL_MS };
		this.random = options.random ?? true;
	}

	setTUI(tui: TUI): void {
		this.tui = tui;
	}

	getFrame(): string {
		if (!this.working) return "";

		return this.frames[this.frameIndex] ?? "";
	}

	start(): void {
		this.stop();

		this.working = true;
		this.tick();
	}

	stop(): void {
		this.working = false;
		this.frameIndex = -1;

		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = undefined;
		}

		this.tui?.requestRender();
	}

	dispose(): void {
		this.stop();
		this.tui = undefined;
	}

	private tick(): void {
		if (!this.working) return;

		this.frameIndex = this.random ? Math.floor(Math.random() * this.frames.length) : (this.frameIndex + 1) % this.frames.length;
		this.tui?.requestRender();

		const delay = typeof this.interval === "number" ? this.interval : this.interval.min + Math.floor(Math.random() * (this.interval.max - this.interval.min + 1));
		this.timer = setTimeout(() => this.tick(), delay);
	}
}

class Editor extends CustomEditor {
	private spinner: Spinner;
	private pi: ExtensionAPI;
	private ctx: ExtensionContext;

	constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager, spinner: Spinner, pi: ExtensionAPI, ctx: ExtensionContext) {
		super(tui, theme, keybindings);

		this.spinner = spinner;
		this.spinner.setTUI(tui);

		this.pi = pi;
		this.ctx = ctx;
	}

	render(width: number): string[] {
		const lines = super.render(width);
		if (lines.length === 0) return lines;

		lines[0] = this.renderTopBorder(width);

		return lines;
	}

	private renderTopBorder(width: number): string {
		const theme = this.ctx.ui.theme;

		const left = theme.fg("accent", this.spinner.getFrame());
		const right = theme.fg("dim", formatModel(this.ctx.model?.provider, this.ctx.model?.id, this.pi.getThinkingLevel()));

		return new SplitLine(left, right, 1, 2, "left", this.borderColor("─"), theme.fg("dim", "…")).render(width)[0];
	}
}

export default function (pi: ExtensionAPI) {
	const spinner = new Spinner();

	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;

		ctx.ui.setWorkingVisible(false);
		ctx.ui.setEditorComponent((tui, theme, keybindings) => new Editor(tui, theme, keybindings, spinner, pi, ctx));
	});

	pi.on("agent_start", () => {
		spinner.start();
	});

	pi.on("agent_end", () => {
		spinner.stop();
	});

	pi.on("session_shutdown", () => {
		spinner.dispose();
	});
}
