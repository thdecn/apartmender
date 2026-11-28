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
  \mark \markup { \box \bold "m. 60" }
  \acciaccatura d''8
c''8.\trill-3(
b'16-.-2)
b'4-3
r2
  g''8\mp
  \bar "|."
}

lowerCard = {
  f'16-2\mp
g'16
e'16-3
g'16
d'16-4
g'16
e'16-3
g'16
f'16
g'16
e'16
g'16
f'16
g'16
d'16
g'16
  e'16 s1*1/16
  \bar "|."
}

\score {
  \new PianoStaff <<
    \set PianoStaff.connectArpeggios = ##t
    \new Staff = "upper" \with { clefGlyph = "clefs.G" clefPosition = #-2 middleCClefPosition = #-6 middleCPosition = #-6 timeSignature = #'(4 . 4) keyAlterations = #'() } \upperCard
    \new Staff = "lower" \with { clefGlyph = "clefs.G" clefPosition = #-2 middleCClefPosition = #-6 middleCPosition = #-6 timeSignature = #'(4 . 4) keyAlterations = #'() } \lowerCard
  >>
  \layout {
    ragged-right = ##f
    system-count = 1
  }
}
