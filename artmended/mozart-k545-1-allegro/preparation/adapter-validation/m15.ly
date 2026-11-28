\version "2.26.0"
#(set-global-staff-size 25)

\paper {
  indent = 0\mm
  top-margin = 4\mm
  bottom-margin = 4\mm
  left-margin = 4\mm
  right-margin = 4\mm
  paper-width = 150\mm
  paper-height = 75\mm
  print-page-number = ##f
  tagline = ##f
  page-breaking = #ly:one-page-breaking
}

upperCard = {
  \mark \markup { \box \bold "m. 15" }
  \acciaccatura a''8
g''8.\trill-3(
fis''16-.-2)
fis''4-3
r2
  d'''8\mp
  \bar "|."
}

lowerCard = {
  c'16-2\mp
d'16
b16-3
d'16
a16-4
d'16
b16-3
d'16
c'16
d'16
b16
d'16
c'16
d'16
a16
d'16
  b16 s1*1/16
  \bar "|."
}

\score {
  \new PianoStaff <<
    \set PianoStaff.connectArpeggios = ##t
    \new Staff = "upper" \with { clefGlyph = "clefs.G" clefPosition = #-2 middleCClefPosition = #-6 middleCPosition = #-6 timeSignature = #'(4 . 4) keyAlterations = #'() } \upperCard
    \new Staff = "lower" \with { clefGlyph = "clefs.F" clefPosition = #2 middleCClefPosition = #6 middleCPosition = #6 timeSignature = #'(4 . 4) keyAlterations = #'() } \lowerCard
  >>
  \layout {
    ragged-right = ##f
    system-count = 1
  }
}
