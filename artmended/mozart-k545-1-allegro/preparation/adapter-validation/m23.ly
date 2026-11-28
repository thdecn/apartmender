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
  \mark \markup { \box \bold "m. 23" }
  \acciaccatura { gis''8-2 }
a''4.->
b''32(
a''32
gis''32
a''32
c'''8-5
a''8-3)
c'''8(
a''8)
  b''8-3(\f
  \bar "|."
}

lowerCard = {
  < c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
  d'16_5 s1*1/16
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
