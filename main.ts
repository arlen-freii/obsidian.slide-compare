import { Plugin, TFile, setTooltip } from "obsidian";
import { Err, Ok, Result } from "ts-results";

const BLOCK_DATA_PATTERN =
	/^images: ?!\[\[(.+)\]\] ?!\[\[(.+)\]\] *(\r\n|\r|\n)*([\s\S]*)/g;
const LANGUAGE_ALIAS = "compare-images";
const IMAGE_FORMATS = [
	"avif",
	"bmp",
	"gif",
	"jpeg",
	"jpg",
	"png",
	"svg",
	"webp",
];

export default class SlideCompare extends Plugin {
	async onload() {
		this.registerMarkdownCodeBlockProcessor(
			LANGUAGE_ALIAS,
			(source, el) => {
				this.renderBlock(source, el);
			},
		);
	}

	renderBlock(source: string, el: HTMLElement) {
		const blockData = this.parseBlockData(source);

		blockData.ok
			? this.renderComparisonBlock(el, blockData.val)
			: this.renderErrorBlock(el, blockData.val);
	}

	parseBlockData(
		source: string,
	): Result<{ images: Array<TFile>; figure: string }, string> {
		const activeFile = this.app.workspace.getActiveFile()?.path;

		// Figure out the best way to handle this.
		// This should never happen in the first place.
		if (activeFile === undefined) throw Error;

		const blockDataMatch = [...source.matchAll(BLOCK_DATA_PATTERN)][0];
		if (blockDataMatch === undefined) {
			return Err("Invalid comparison block formatting.");
		}

		const leftImage = this.app.metadataCache.getFirstLinkpathDest(
			blockDataMatch[1],
			activeFile,
		);
		const rightImage = this.app.metadataCache.getFirstLinkpathDest(
			blockDataMatch[2],
			activeFile,
		);
		const figureText = blockDataMatch[4];

		if (leftImage === null || rightImage === null) {
			return Err("Invalid markdown embed file link.");
		}
		if (
			!IMAGE_FORMATS.includes(leftImage.extension) ||
			!IMAGE_FORMATS.includes(rightImage.extension)
		) {
			return Err("Markdown embed file provided isn't an image.");
		}

		return Ok({
			images: [leftImage, rightImage],
			figure: figureText,
		});
	}

	renderComparisonBlock(
		el: HTMLElement,
		blockData: { images: Array<TFile>; figure: string },
	) {
		const vault = blockData.images[0].vault;

		const rootBlock = createDiv({ cls: "slide-compare" });

		// Creating right first so it's below.
		const rightImageContainer = rootBlock.createDiv({
			cls: "sc-image-container sc-right-container",
		});
		const leftImageContainer = rootBlock.createDiv({
			cls: "sc-image-container sc-left-container",
		});

		leftImageContainer.createEl("img", {
			cls: "sc-compared-image sc-left-image",
			attr: { src: vault.getResourcePath(blockData.images[0]) },
		});
		rightImageContainer.createEl("img", {
			cls: "sc-compared-image sc-right-image",
			attr: { src: vault.getResourcePath(blockData.images[1]) },
		});

		const sliderContainer = rootBlock.createDiv({
			cls: "sc-slider-container",
		});
		sliderContainer.createDiv({ cls: "sc-ratio-slider" });

		const listener = (e: MouseEvent) => {
			if (e.buttons !== 1) return;
			const boundingBox = rootBlock.getBoundingClientRect();
			const sliderRatio =
				(e.clientX - boundingBox.left) /
				(boundingBox.right - boundingBox.left);
			rootBlock.style.setProperty("--sc-ratio", `${sliderRatio * 100}%`);
		};

		rootBlock.addEventListener("mousemove", (e) => {
			listener(e);
		});
		rootBlock.addEventListener("mousedown", (e) => {
			listener(e);
		});

		el.appendChild(rootBlock);

		const returnSliderButton = createDiv({
			cls: "sc-return-slider-button edit-block-button",
		});
		returnSliderButton.innerHTML = returnSvg;
		setTooltip(returnSliderButton, "Return slider");

		returnSliderButton.addEventListener("click", () => {
			rootBlock.style.removeProperty("--sc-ratio");
		});

		el.parentNode?.appendChild(returnSliderButton);
		el.replaceWith(el);
	}

	renderErrorBlock(el: HTMLElement, message: string) {
		const rootBlock = createDiv({ cls: "slide-compare" });
		rootBlock.createEl("pre", {
			cls: "sc-error-block",
			text: ERROR_MESSAGE_WRAPPER.format(message),
		});

		el.appendChild(rootBlock);
	}
}

const ERROR_MESSAGE_WRAPPER =
	"Slide Compare has encountered an error:\n" +
	"- {0}\n\n" +
	"Please review this block and try again.";

const returnSvg =
	'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide lucide-undo-2"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>';
