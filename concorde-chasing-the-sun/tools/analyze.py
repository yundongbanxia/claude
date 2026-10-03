#!/usr/bin/env python3
"""粗略分析音轨：每个小节(3 s)的 RMS / 峰值（dBFS），用来检查整体响度曲线和削波。"""
import sys, wave, audioop, math
f = sys.argv[1]
w = wave.open(f, 'rb')
sr, ch, sw = w.getframerate(), w.getnchannels(), w.getsampwidth()
seg = int(sr * 3.0)
i = 0
print('bar  time     RMS dB   peak dB')
while True:
    d = w.readframes(seg)
    if not d: break
    rms = audioop.rms(d, sw); peak = audioop.max(d, sw)
    full = float(1 << (8 * sw - 1))
    r = 20 * math.log10(max(rms, 1) / full); p = 20 * math.log10(max(peak, 1) / full)
    bar = '#' * max(0, int((r + 50) * 1.2))
    print(f'{i:3d}  {i*3:3d}s  {r:7.1f}  {p:7.1f}  {bar}')
    i += 1
