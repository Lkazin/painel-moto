Add-Type -AssemblyName System.Drawing

function Generate-PwaIcon {
    param(
        [int]$size,
        [string]$outputPath
    )

    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # 1. Background Rounded Rectangle
    $margin = [Math]::Max(4, [int]($size * 0.04))
    $rectWidth = $size - ($margin * 2)
    $rectHeight = $size - ($margin * 2)
    $radius = [int]($size * 0.22)
    $rect = New-Object System.Drawing.Rectangle($margin, $margin, $rectWidth, $rectHeight)

    # Rounded path
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2
    $path.AddArc($rect.X, $rect.Y, $diameter, $diameter, 180, 90)
    $path.AddArc($rect.Right - $diameter, $rect.Y, $diameter, $diameter, 270, 90)
    $path.AddArc($rect.Right - $diameter, $rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()

    # Linear Gradient from vivid rose/magenta to deep purple
    $c1 = [System.Drawing.Color]::FromArgb(255, 255, 61, 110)   # #FF3D6E
    $c2 = [System.Drawing.Color]::FromArgb(255, 139, 47, 232)  # #8B2FE8
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF(0, 0)),
        (New-Object System.Drawing.PointF($size, $size)),
        $c1, $c2
    )
    $g.FillPath($brush, $path)

    # Neon border
    $borderPen = New-Object System.Drawing.Pen(
        [System.Drawing.Color]::FromArgb(200, 255, 200, 235),
        [Math]::Max(2, [float]($size * 0.02))
    )
    $g.DrawPath($borderPen, $path)

    # 2. Draw Motorcycle and Rider Icon
    $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(3, [float]($size * 0.042)))
    $whitePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $whitePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $whitePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)

    # Scale factor relative to 512 base
    $s = $size / 512.0

    # Speed lines
    $g.DrawLine($whitePen, [float](70 * $s), [float](220 * $s), [float](150 * $s), [float](220 * $s))
    $g.DrawLine($whitePen, [float](50 * $s), [float](260 * $s), [float](130 * $s), [float](260 * $s))
    $g.DrawLine($whitePen, [float](80 * $s), [float](300 * $s), [float](140 * $s), [float](300 * $s))

    # Wheels (outer circles)
    $wheelR = 50 * $s
    $wheelPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(3, [float]($size * 0.048)))
    # Rear wheel (left)
    $g.DrawEllipse($wheelPen, [float](150 * $s), [float](310 * $s), [float]($wheelR * 2), [float]($wheelR * 2))
    # Front wheel (right)
    $g.DrawEllipse($wheelPen, [float](340 * $s), [float](310 * $s), [float]($wheelR * 2), [float]($wheelR * 2))

    # Rider head
    $headR = 26 * $s
    $g.FillEllipse($whiteBrush, [float](290 * $s), [float](150 * $s), [float]($headR * 2), [float]($headR * 2))

    # Rider body & arms
    $g.DrawLine($whitePen, [float](280 * $s), [float](205 * $s), [float](310 * $s), [float](230 * $s))
    $g.DrawLine($whitePen, [float](310 * $s), [float](230 * $s), [float](350 * $s), [float](250 * $s)) # arms to handlebar
    $g.DrawLine($whitePen, [float](280 * $s), [float](205 * $s), [float](240 * $s), [float](280 * $s)) # torso
    $g.DrawLine($whitePen, [float](240 * $s), [float](280 * $s), [float](285 * $s), [float](330 * $s)) # leg to footrest

    # Motorcycle frame
    $g.DrawLine($whitePen, [float](200 * $s), [float](360 * $s), [float](270 * $s), [float](280 * $s)) # rear hub to engine
    $g.DrawLine($whitePen, [float](270 * $s), [float](280 * $s), [float](350 * $s), [float](250 * $s)) # tank to fork
    $g.DrawLine($whitePen, [float](350 * $s), [float](250 * $s), [float](390 * $s), [float](360 * $s)) # fork to front hub
    $g.DrawLine($whitePen, [float](200 * $s), [float](360 * $s), [float](300 * $s), [float](360 * $s)) # bottom swingarm

    # Clean up and save
    $g.Dispose()
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Gerado: $outputPath ($size x $size)"
}

$destDir = "C:\Users\camil\Downloads\painel motoboy\public"
Generate-PwaIcon -size 512 -outputPath "$destDir\icon-512.png"
Generate-PwaIcon -size 192 -outputPath "$destDir\icon-192.png"
Generate-PwaIcon -size 180 -outputPath "$destDir\apple-touch-icon.png"
Generate-PwaIcon -size 512 -outputPath "$destDir\icon-maskable.png"
