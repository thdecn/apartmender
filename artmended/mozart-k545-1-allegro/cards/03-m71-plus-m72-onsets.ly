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
  \mark \markup { \box \bold "m. 71" }
  \override PhrasingSlur.direction = #1

c''4^\finger "(2)"-.\)
c''16-2\(
g'16_>
c''16
e''16-4
g''16
e''16-4
c''16
e''16-4
f''16_>
d''16-3
b'16
d''16-3
  c''4^\finger "(1)"-.
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  < c'-2 e'-1 >4-.
r4
r4
< g d' f' >4(
  \override Slur.direction = #-1

< c'_3 e'_1 >4-.)
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
