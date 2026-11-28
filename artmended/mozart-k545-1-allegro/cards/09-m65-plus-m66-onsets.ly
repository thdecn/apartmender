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
  \mark \markup { \box \bold "m. 65" }
  e'''4->-5
r16
e'''16(
c'''16
a''16
f''4)
r16
f''16(
a''16
f''16
  d'''4->-5)
  \bar "|."
}

lowerCard = {
  \clef "treble"
  \key c \major
  \time 4/4
  r16
c'16-5(
e'16-4
a'16-2
c''4)
r16
d'16-5(
f'16-4
a'16-2
d''4)
  r16
b16-5 s1*1/8
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
