"""Compose honest Kongregate marketing images from captured Galalaxy screens."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import random

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "qa" / "reliability-2026-09-05"
OUTPUT = ROOT / "docs" / "kongregate"
SIZE = (1200, 675)


def font(size, bold=False):
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(f"C:/Windows/Fonts/{name}", size)


def background(source, accent):
    shot = Image.open(source).convert("RGB")
    scale = max(SIZE[0] / shot.width, SIZE[1] / shot.height)
    blurred = shot.resize((round(shot.width * scale), round(shot.height * scale)), Image.Resampling.LANCZOS)
    x = (blurred.width - SIZE[0]) // 2
    y = (blurred.height - SIZE[1]) // 2
    canvas = blurred.crop((x, y, x + SIZE[0], y + SIZE[1])).filter(ImageFilter.GaussianBlur(34))
    shade = Image.new("RGBA", SIZE, (1, 5, 18, 188))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shade)
    glow = Image.new("RGBA", SIZE)
    gd = ImageDraw.Draw(glow)
    for radius in range(360, 20, -20):
        alpha = round(1.8 * (360 - radius) / 360 + 1)
        gd.ellipse((880-radius, 330-radius, 880+radius, 330+radius), fill=(*accent, alpha))
    canvas = Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(28)))
    random.seed(17)
    draw = ImageDraw.Draw(canvas)
    for _ in range(90):
        px, py = random.randrange(18, 1182), random.randrange(18, 657)
        a = random.randrange(35, 125)
        draw.ellipse((px, py, px + 2, py + 2), fill=(190, 232, 255, a))
    return canvas


def screen_card(canvas, source, box, crop=None):
    x, y, w, h = box
    shot = Image.open(source).convert("RGB")
    if crop:
        shot = shot.crop(crop)
    ratio = min(w / shot.width, h / shot.height)
    shot = shot.resize((round(shot.width * ratio), round(shot.height * ratio)), Image.Resampling.LANCZOS)
    sx = x + (w - shot.width) // 2
    sy = y + (h - shot.height) // 2
    shadow = Image.new("RGBA", SIZE)
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((sx-12, sy-12, sx+shot.width+12, sy+shot.height+12), 28, fill=(0, 0, 0, 180))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(20)))
    canvas.paste(shot, (sx, sy))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((sx-3, sy-3, sx+shot.width+3, sy+shot.height+3), 18, outline=(75, 226, 255, 210), width=3)


def copy_block(canvas, headline, body, kicker="GALALAXY"):
    draw = ImageDraw.Draw(canvas)
    draw.text((72, 74), kicker, font=font(23, True), fill=(90, 230, 255, 235))
    draw.line((72, 111, 235, 111), fill=(220, 70, 245, 210), width=4)
    y = 164
    for line in headline.split("\n"):
        draw.text((70, y), line, font=font(57, True), fill=(245, 252, 255, 255), stroke_width=1, stroke_fill=(40, 110, 145))
        y += 67
    y += 24
    for line in body.split("\n"):
        draw.text((73, y), line, font=font(24), fill=(190, 215, 235, 240))
        y += 37


def progression_panel(canvas):
    draw = ImageDraw.Draw(canvas)
    panel = (650, 28, 1155, 646)
    draw.rounded_rectangle(panel, 28, fill=(3, 10, 28, 225), outline=(67, 224, 255, 220), width=3)
    draw.text((686, 65), "VISIBLE SHIP EVOLUTION", font=font(21, True), fill=(102, 232, 255, 255))
    draw.text((686, 99), "Every module changes your silhouette.", font=font(17), fill=(177, 201, 224, 235))

    stages = [
        ("ship-01-starter.png", "01", "STARTER", "BASE HULL", 674, 108, (88, 230, 255)),
        ("ship-02-armed.png", "02", "ARMED", "ROCKETS + SHIELD", 832, 132, (255, 178, 70)),
        ("ship-03-ascended.png", "03", "ASCENDED", "FULL ARSENAL\n+ KEYSTONE", 990, 158, (221, 99, 255)),
    ]
    card_top, card_bottom, card_width = 140, 526, 142
    for index, (name, step, label, detail, card_x, target, accent) in enumerate(stages):
        draw.rounded_rectangle(
            (card_x, card_top, card_x + card_width, card_bottom), 18,
            fill=(8, 20, 43, 238), outline=(*accent, 155), width=2,
        )
        draw.text((card_x + 14, 158), step, font=font(14, True), fill=(*accent, 210))
        draw.text((card_x + 14, 182), label, font=font(16, True), fill=(243, 249, 255, 255))
        draw.line((card_x + 14, 210, card_x + card_width - 14, 210), fill=(*accent, 110), width=2)

        ship = Image.open(OUTPUT / "source" / name).convert("RGBA")
        alpha_box = ship.getchannel("A").getbbox()
        ship = ship.crop(alpha_box)
        scale = min(target / ship.width, target / ship.height)
        ship = ship.resize((round(ship.width * scale), round(ship.height * scale)), Image.Resampling.NEAREST)
        cx, cy = card_x + card_width // 2, 334
        halo = Image.new("RGBA", SIZE)
        hd = ImageDraw.Draw(halo)
        radius = target // 2 + 10
        hd.ellipse((cx-radius, cy-radius, cx+radius, cy+radius), fill=(*accent, 40))
        canvas.alpha_composite(halo.filter(ImageFilter.GaussianBlur(13)))
        canvas.alpha_composite(ship, (round(cx - ship.width / 2), round(cy - ship.height / 2)))
        detail_y = 465 if "\n" not in detail else 450
        for line in detail.split("\n"):
            draw.text((cx, detail_y), line, anchor="mm", font=font(12, True), fill=(*accent, 245))
            detail_y += 20
        if index < len(stages) - 1:
            arrow_x = card_x + card_width + 8
            draw.polygon(
                ((arrow_x - 4, 326), (arrow_x + 6, 334), (arrow_x - 4, 342)),
                fill=(205, 229, 244, 225),
            )

    draw.rounded_rectangle((696, 560, 1108, 615), 16, fill=(18, 48, 78, 230), outline=(255, 84, 225, 150), width=2)
    draw.text((902, 587), "CHOOSE  •  INSTALL  •  TRANSFORM", anchor="mm",
              font=font(16, True), fill=(243, 249, 255, 255))


def save(name, source, accent, headline, body, card_box, crop=None):
    canvas = background(source, accent)
    copy_block(canvas, headline, body)
    screen_card(canvas, source, card_box, crop)
    canvas.convert("RGB").save(OUTPUT / name, quality=94, subsampling=0, optimize=True)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    icon = Image.open(OUTPUT / "galalaxy-icon-1024.png").convert("RGB")
    crop_height = round(icon.width * 0.8)
    crop_top = (icon.height - crop_height) // 2
    icon.crop((0, crop_top, icon.width, crop_top + crop_height)).resize(
        (1000, 800), Image.Resampling.LANCZOS
    ).save(OUTPUT / "galalaxy-icon-1000x800.png", optimize=True)
    save(
        "01-survive-the-fleet.jpg", OUTPUT / "source" / "fleet-assault.png", (255, 55, 110),
        "SURVIVE\nTHE FLEET", "Bosses bring an army.\nYour whole build fires back.",
        (690, 12, 462, 650),
    )
    progression = background(OUTPUT / "source" / "fleet-assault.png", (45, 200, 255))
    copy_block(progression, "BUILD YOUR\nWARSHIP", "Start small. Install modules.\nBecome a screen-filling arsenal.")
    progression_panel(progression)
    progression.convert("RGB").save(OUTPUT / "02-build-your-warship.jpg", quality=94, subsampling=0, optimize=True)
    save(
        "03-unleash-everything.jpg", OUTPUT / "source" / "finale-assault.png", (120, 80, 255),
        "UNLEASH\nEVERYTHING", "Stack weapons. Trigger synergies.\nBreak the Void Core.",
        (690, 12, 462, 650),
    )
    for image in sorted([*OUTPUT.glob("*.jpg"), OUTPUT / "galalaxy-icon-1000x800.png"]):
        print(f"{image.name}: {Image.open(image).size}")


if __name__ == "__main__":
    main()
