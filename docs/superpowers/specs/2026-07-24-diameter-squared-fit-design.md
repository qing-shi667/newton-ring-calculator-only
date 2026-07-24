# Diameter-Squared Fit Design

## Objective

Correct the Newton's rings calculator so its regression uses measured dark-ring diameter squared rather than radius squared. Every visible formula must use `D²ₖ`, with the superscript `2` immediately after `D` and the subscript `k` after it, so the display cannot be read as `k²`.

## Calculation

- Parse each input row as ring order `k` and measured dark-ring diameter `D` in millimetres.
- Use `D²` directly as the regression ordinate; do not divide the diameter by two.
- Fit `D²ₖ = slope * k + intercept`.
- Use the Newton's rings relation `D²ₖ = 4kλR + b`.
- Calculate `R = slope / (4λ)`.
- Propagate the slope standard uncertainty as `u_A(R) = u(slope) / (4λ)`.
- Keep the existing B-type, combined, expanded uncertainty, and final unit-conversion flow unchanged.

The fitted slope and its uncertainty become four times their previous radius-squared values, while the resulting curvature radius and its uncertainty remain numerically unchanged.

## Display

- Result equation: `D²ₖ = <slope>k + <intercept>`.
- Chart legend: `实验数据(k, D²ₖ)`.
- Chart vertical axis: `D²ₖ (mm²)`.
- README: describe a `D²ₖ-k` fit.
- Remove every user-facing `r²` reference from the calculator-only repository.

The correlation coefficient remains `r` because it denotes the statistical correlation coefficient, not ring radius.

## Verification

- Execute the real inline calculator script with a mocked DOM and Chart object.
- Verify the plotted ordinate equals the supplied diameter squared, not one quarter of it.
- Verify the result equation uses `D²ₖ`.
- Verify the curvature radius still matches `slope / (4λ)`.
- Verify no user-facing `r²` text remains.

## Non-Goals

- Do not change page layout, colors, sample data, input format, or uncertainty model beyond the required factor of four in slope propagation.
- Do not add AI, OCR, backend services, or external math-rendering libraries.
