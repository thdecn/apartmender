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
  \clef treble
  \key c \major
  \time 4/4
  \mark \markup { \box \bold "m. 66" }
  d'''4->-5)
r16
d'''16-5(
b''16-4
g''16-2
e''4)
r16
c'''16-5(
g''16-3
e''16-2
  d''2^\finger "(1)"\p)
  \bar "|."
}

lowerCard = {
  \clef "treble"
  \key c \major
  \time 4/4
  r16
b16-5(
d'16-4
g'16-2
b'4)
r16
c'16-5(
e'16-4
g'16-2
c''4)
  r8
< f' a' >8_\finger "(53)"-. s1*1/4
  \bar "|."
}

\score {
  \new PianoStaff <<
    \set PianoStaff.connectArpeggios = ##t
    \new Staff = "upper" \upperCard
    \new Staff = "lower" \lowerCard
  >>
  \layout {
    ragged-right = ##f
    system-count = 1
  }
}
