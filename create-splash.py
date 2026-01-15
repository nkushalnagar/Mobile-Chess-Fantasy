#!/usr/bin/env python3
"""
Generate splash screen from logo with transparent background
"""

from PIL import Image, ImageDraw

# Configuration
LOGO_PATH = "assets/images/logo.png"  # Your logo with transparent background
OUTPUT_PATH = "assets/splash.png"
SPLASH_SIZE = (1284, 2778)  # iPhone 14 Pro Max resolution
BACKGROUND_COLOR = (15, 23, 42)  # #0f172a - your app's dark blue
LOGO_SCALE = 0.4  # Logo will be 40% of screen width

def create_splash_screen():
    """Create splash screen with centered logo on dark background"""
    
    # Create background
    splash = Image.new('RGB', SPLASH_SIZE, BACKGROUND_COLOR)
    
    # Load logo
    try:
        logo = Image.open(LOGO_PATH)
        print(f"✓ Loaded logo: {LOGO_PATH}")
        print(f"  Original size: {logo.size}")
    except FileNotFoundError:
        print(f"✗ Error: Could not find logo at {LOGO_PATH}")
        print(f"  Make sure logo.png exists in assets/images/")
        return False
    
    # Calculate logo size (maintain aspect ratio)
    target_width = int(SPLASH_SIZE[0] * LOGO_SCALE)
    aspect_ratio = logo.height / logo.width
    target_height = int(target_width * aspect_ratio)
    
    # Resize logo
    logo_resized = logo.resize((target_width, target_height), Image.Resampling.LANCZOS)
    print(f"✓ Resized logo to: {logo_resized.size}")
    
    # Calculate position to center logo
    x = (SPLASH_SIZE[0] - target_width) // 2
    y = (SPLASH_SIZE[1] - target_height) // 2
    
    # Paste logo onto splash (with alpha channel for transparency)
    if logo_resized.mode == 'RGBA':
        splash.paste(logo_resized, (x, y), logo_resized)
    else:
        splash.paste(logo_resized, (x, y))
    
    print(f"✓ Centered logo at position: ({x}, {y})")
    
    # Save splash screen
    splash.save(OUTPUT_PATH, 'PNG', optimize=True)
    print(f"✓ Saved splash screen: {OUTPUT_PATH}")
    print(f"  Size: {SPLASH_SIZE}")
    print(f"  Background: #{BACKGROUND_COLOR[0]:02x}{BACKGROUND_COLOR[1]:02x}{BACKGROUND_COLOR[2]:02x}")
    
    return True

if __name__ == "__main__":
    print("Creating splash screen...")
    print("-" * 50)
    
    success = create_splash_screen()
    
    print("-" * 50)
    if success:
        print("✓ Splash screen created successfully!")
        print("\nNext steps:")
        print("1. Check assets/splash.png to verify it looks good")
        print("2. Restart your Expo app to see the new splash screen")
    else:
        print("✗ Failed to create splash screen")
