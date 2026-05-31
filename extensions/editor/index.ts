import { CustomEditor } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

import { formatModel } from "../shared/utils/format";

import type { ExtensionContext, ExtensionAPI, KeybindingsManager } from "@earendil-works/pi-coding-agent";
import type { TUI, EditorTheme } from "@earendil-works/pi-tui";

const SPINNER_FRAMES = ["○○○○", "●○○○", "○●○○", "○○●○", "○○○●", "●●○○", "●○●○", "●○○●", "○●●○", "○●○●", "○○●●", "●●●○", "●●○●", "●○●●", "○●●●", "●●●●"];
const SPINNER_MIN_INTERVAL_MS = 120;
const SPINNER_MAX_INTERVAL_MS = 240;

class Spinner {
	private tui: TUI | undefined;
	private working: boolean = false;
	private frame: string = this.randomFrame();
	private timer: ReturnType<typeof setTimeout> | undefined;

	setTUI(tui: TUI): void {
		this.tui = tui;
	}

	isWorking(): boolean {
		return this.working;
	}

	getFrame(): string {
		return this.frame;
	}

	start(): void {
		this.stop();

		this.working = true;
		this.frame = this.randomFrame();

		this.requestRender();
		this.scheduleTick();
	}

	stop(): void {
		this.working = false;

		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = undefined;
		}

		this.requestRender();
	}

	dispose(): void {
		this.stop();
		this.tui = undefined;
	}

	private requestRender(): void {
		this.tui?.requestRender();
	}

	private scheduleTick(): void {
		if (!this.working) return;

		this.timer = setTimeout(() => {
			if (!this.working) return;
			this.frame = this.randomFrame();

			this.requestRender();
			this.scheduleTick();
		}, this.randomInterval());
	}

	private randomFrame(): string {
		return SPINNER_FRAMES[Math.floor(Math.random() * SPINNER_FRAMES.length)]!;
	}

	private randomInterval(): number {
		return SPINNER_MIN_INTERVAL_MS + Math.floor(Math.random() * (SPINNER_MAX_INTERVAL_MS - SPINNER_MIN_INTERVAL_MS + 1));
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
		if (width <= 2) return this.borderColor("─".repeat(width));

		const theme = this.ctx.ui.theme;

		const left = this.spinner.isWorking() ? ` ${theme.fg("accent", this.spinner.getFrame())} ` : "";
		const right = theme.fg("dim", ` ${formatModel(this.ctx.model?.provider, this.ctx.model?.id, this.pi.getThinkingLevel())} `);

		const contentWidth = width - 2;
		const gapWidth = 1;

		const leftWidth = visibleWidth(left);
		const rightWidth = visibleWidth(right);
		const ellipsis = theme.fg("dim", "... ");

		if (leftWidth >= contentWidth) return this.wrapTopBorder(truncateToWidth(left, contentWidth, ellipsis));

		const availableRightWidth = contentWidth - gapWidth - leftWidth;
		if (availableRightWidth <= 5) return this.wrapTopBorder(`${left}${this.borderColor("─".repeat(contentWidth - leftWidth))}`);

		const renderedRight = rightWidth > availableRightWidth ? truncateToWidth(right, availableRightWidth, ellipsis) : right;
		const renderedRightWidth = visibleWidth(renderedRight);
		const spacer = this.borderColor("─".repeat(contentWidth - leftWidth - renderedRightWidth));

		return this.wrapTopBorder(`${left}${spacer}${renderedRight}`);
	}

	private wrapTopBorder(text: string): string {
		return `${this.borderColor("─")}${text}${this.borderColor("─")}`
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
