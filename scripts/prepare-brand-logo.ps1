param([Parameter(Mandatory=$true)][string]$SourcePath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$brandRoot = Join-Path $PSScriptRoot '..\brand'
New-Item -ItemType Directory -Path $brandRoot -Force | Out-Null
$source = [System.Drawing.Bitmap]::new((Resolve-Path -LiteralPath $SourcePath).Path)
function Find-LogoBounds([int]$Top, [int]$Bottom) {
  $left=$source.Width; $right=-1; $first=$source.Height; $last=-1
  for($y=$Top; $y -lt $Bottom; $y++) {
    for($x=0; $x -lt $source.Width; $x++) {
      if($source.GetPixel($x,$y).A -ge 32) {
        $left=[Math]::Min($left,$x); $right=[Math]::Max($right,$x)
        $first=[Math]::Min($first,$y); $last=[Math]::Max($last,$y)
      }
    }
  }
  if($right -lt 0) { throw 'No logo pixels found.' }
  return [System.Drawing.Rectangle]::new($left-2,$first-2,$right-$left+5,$last-$first+5)
}
function New-LogoCanvas([int]$Width,[int]$Height,[bool]$White=$false) {
  $bitmap=[System.Drawing.Bitmap]::new($Width,$Height,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  if($White) { $g=[System.Drawing.Graphics]::FromImage($bitmap); $g.Clear([System.Drawing.Color]::White); $g.Dispose() }
  return ,$bitmap
}
function Paint-Logo($Canvas,$Crop,$Target) {
  $g=[System.Drawing.Graphics]::FromImage($Canvas)
  $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.CompositingQuality=[System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($source,$Target,$Crop,[System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
}
function Save-Logo($Canvas,[string]$Path) { $Canvas.Save($Path,[System.Drawing.Imaging.ImageFormat]::Png); $Canvas.Dispose() }
try {
  # This supplied logo has its wordmark below the shield, separated at y=890/1254.
  $split=[int][Math]::Round($source.Height*890/1254)
  $mark=Find-LogoBounds 0 $split
  $word=Find-LogoBounds $split $source.Height
  $full=Find-LogoBounds 0 $source.Height
  $lockup=New-LogoCanvas 800 200
  $markWidth=[int][Math]::Round(192*$mark.Width/$mark.Height)
  Paint-Logo $lockup $mark ([System.Drawing.Rectangle]::new(0,4,$markWidth,192))
  $wordWidth=800-$markWidth-28
  $wordHeight=[int][Math]::Round($wordWidth*$word.Height/$word.Width)
  Paint-Logo $lockup $word ([System.Drawing.Rectangle]::new($markWidth+28,[int]((200-$wordHeight)/2),$wordWidth,$wordHeight))
  Save-Logo $lockup (Join-Path $brandRoot 'babyguard-horizontal.png')
  $fullWidth=800; $fullHeight=[int][Math]::Round($fullWidth*$full.Height/$full.Width)
  $fullLogo=New-LogoCanvas $fullWidth $fullHeight
  Paint-Logo $fullLogo $full ([System.Drawing.Rectangle]::new(0,0,$fullWidth,$fullHeight))
  Save-Logo $fullLogo (Join-Path $brandRoot 'babyguard-logo.png')
  $social=New-LogoCanvas 1200 630 $true
  $socialHeight=530; $socialWidth=[int][Math]::Round($socialHeight*$full.Width/$full.Height)
  Paint-Logo $social $full ([System.Drawing.Rectangle]::new([int]((1200-$socialWidth)/2),50,$socialWidth,$socialHeight))
  Save-Logo $social (Join-Path $brandRoot 'babyguard-social.png')
  $icons=@{16='favicon-16x16.png';32='favicon-32x32.png';48='brand/babyguard-icon-48.png';96='favicon-96x96.png';180='apple-touch-icon.png';192='android-chrome-192x192.png';256='brand/babyguard-icon-256.png';512='android-chrome-512x512.png'}
  foreach($size in $icons.Keys) {
    $icon=New-LogoCanvas $size $size
    $height=[int][Math]::Round($size*.9); $width=[int][Math]::Round($height*$mark.Width/$mark.Height)
    Paint-Logo $icon $mark ([System.Drawing.Rectangle]::new([int](($size-$width)/2),[int](($size-$height)/2),$width,$height))
    Save-Logo $icon (Join-Path $PSScriptRoot ('..\'+$icons[$size]))
  }
  $iconPaths=@('favicon-16x16.png','favicon-32x32.png','brand/babyguard-icon-48.png','brand/babyguard-icon-256.png')
  $sizes=@(16,32,48,256)
  $stream=[System.IO.MemoryStream]::new(); $writer=[System.IO.BinaryWriter]::new($stream)
  $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]4)
  $offset=6+16*4; $chunks=@()
  for($i=0;$i -lt 4;$i++) {
    $bytes=[System.IO.File]::ReadAllBytes((Join-Path $PSScriptRoot ('..\'+$iconPaths[$i])))
    $chunks+=,$bytes; $dimension=if($sizes[$i] -eq 256){0}else{$sizes[$i]}
    $writer.Write([byte]$dimension); $writer.Write([byte]$dimension); $writer.Write([uint16]0)
    $writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$bytes.Length); $writer.Write([uint32]$offset)
    $offset+=$bytes.Length
  }
  foreach($bytes in $chunks) { $writer.Write([byte[]]$bytes) }
  $writer.Flush()
  foreach($name in @('icon.ico','favicon.ico')) { [System.IO.File]::WriteAllBytes((Join-Path $PSScriptRoot ('..\'+$name)),$stream.ToArray()) }
  $writer.Dispose(); $stream.Dispose()
  $base64=[Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $PSScriptRoot '..\android-chrome-512x512.png')))
  [System.IO.File]::WriteAllText((Join-Path $PSScriptRoot '..\favicon.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><image width="512" height="512" href="data:image/png;base64,'+$base64+'"/></svg>')
} finally { $source.Dispose() }
