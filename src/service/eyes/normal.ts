// Function to draw circles with rings on a canvas
export function drawEyesNormal(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  centerX: number,
  centerY: number,
  radius: number,
  theme: "normal" | "listening" = "normal",
) {
  console.log(theme);

  for (let x = 0; x < canvas.width / 5; x++) {
    for (let y = 0; y < canvas.height / 5; y++) {
      // Calculate distance from center
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If within circle radius and checkerboard pattern, fill with blue
      if (distance <= radius && (x + y) % 2 === 0) {
        const placementFactor = radius / 3.2;
        //const centerXPos = x * 7 + 2.5;
        //const centerYPos = y * 7 + 2.5;

        const centerXPos = x * placementFactor + placementFactor / 2;
        const centerYPos = y * placementFactor + placementFactor / 2;

        const mainColors = {
          0: theme === "listening" ? "#23B9F7" : "#0696d4",
          1: theme === "listening" ? "#1953d1" : "#093fb4",
          2:
            theme === "listening"
              ? "rgba(5, 38, 187, 0.7)"
              : "rgba(5, 38, 187, 0.7)",
          3:
            theme === "listening"
              ? "rgba(2, 27, 137, 0.7)"
              : "rgba(2, 27, 137, 0.7)",
          4:
            theme === "listening"
              ? "rgba(3, 24, 119, 0.5)"
              : "rgba(3, 24, 119, 0.5)",
        };

        // Determine ring based on distance (4 rings, each ~2 circles wide)
        let mainColor, glowColor;
        if (distance <= 10) {
          // Ring 1 (innermost) - Brightest blue
          mainColor = mainColors[0];
          glowColor = "rgba(35, 185, 247, 0.3)";
        } else if (distance <= 11) {
          // Ring 2 - Medium-light blue
          mainColor = mainColors[1];
          glowColor = "rgba(26, 139, 199, 0.3)";
        } else if (distance <= 14) {
          // Ring 3 - Dark blue
          mainColor = mainColors[2];
          glowColor = "rgba(6, 45, 218, 0.3)";
        } else if (distance <= 16) {
          // Ring 3 - Dark blue
          mainColor = mainColors[3];
          glowColor = "rgba(4, 35, 173, 0.2)";
        } else if (distance <= 18) {
          // Ring 3 - Dark blue
          mainColor = mainColors[4];
          glowColor = "rgba(4, 34, 170, 0.1)";
        } else {
          // Ring 4 (outermost) - Almost black blue
          mainColor = "rgba(1, 12, 64, 0.5)";
          glowColor = "rgba(2, 17, 83, 0.1)";
        }

        // Draw glow effect (larger, semi-transparent circle)
        const glowRadius = radius / 3.75;
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(centerXPos, centerYPos, glowRadius, 0, 2 * Math.PI);
        ctx.fill();

        // Draw main circle
        const circleRadius = radius / 7;
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.arc(centerXPos, centerYPos, circleRadius, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }
}

// Function to draw happy eyes (arch of circles)
export function drawEyesHappy(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  centerX: number,
  centerY: number,
  radius: number,
) {
  for (let x = 0; x < canvas.width / 5; x++) {
    for (let y = 0; y < canvas.height / 5; y++) {
      const dx = x - centerX;
      const dy = y - centerY;

      // Create arch shape - parabola opening upward (smile)
      const archWidth = radius * 0.8; // Width of the arch
      const archHeight = radius * 0.06; // Height of the arch (30% of previous height)

      // Calculate the arch curve: y = a(x - centerX)² + centerY - offset (upward-facing)
      const archCurveY =
        centerY - archHeight * 0.3 + (dx * dx) / (archWidth * 0.8);

      // Check if point is near the arch curve and within horizontal bounds
      const distanceFromArch = Math.abs(y - archCurveY);
      const horizontalDistance = Math.abs(dx);

      // Only draw if close to arch curve, within bounds, and checkerboard pattern
      if (
        distanceFromArch <= 3 &&
        horizontalDistance <= archWidth &&
        y >= centerY - archHeight * 0.5 &&
        (x + y) % 2 === 0
      ) {
        const placementFactor = radius / 3.2;
        const centerXPos = x * placementFactor + placementFactor / 2;
        const centerYPos = y * placementFactor + placementFactor / 2;

        // Determine colors based on distance from center of arch
        const distanceFromCenter = Math.abs(dx);
        let mainColor, glowColor;

        if (distanceFromCenter <= archWidth * 0.2) {
          // Center of arch - brightest
          mainColor = "#23B9F7";
          glowColor = "rgba(35, 185, 247, 0.3)";
        } else if (distanceFromCenter <= archWidth * 0.4) {
          mainColor = "#1953d1";
          glowColor = "rgba(26, 139, 199, 0.3)";
        } else if (distanceFromCenter <= archWidth * 0.6) {
          mainColor = "rgba(5, 38, 187, 0.7)";
          glowColor = "rgba(6, 45, 218, 0.3)";
        } else {
          // Edges of arch - darkest
          mainColor = "rgba(2, 27, 137, 0.7)";
          glowColor = "rgba(4, 35, 173, 0.2)";
        }

        // Draw glow effect
        const glowRadius = radius / 3.75;
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(centerXPos, centerYPos, glowRadius, 0, 2 * Math.PI);
        ctx.fill();

        // Draw main circle
        const circleRadius = radius / 7;
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.arc(centerXPos, centerYPos, circleRadius, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }
}
