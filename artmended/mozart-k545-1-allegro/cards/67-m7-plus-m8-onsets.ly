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
  \mark \markup { \box \bold "m. 7" }
  f'8^\finger "(1)"\<
g'16
a'16
b'16-1
c''16
d''16
e''16\!
f''16\>
e''16
d''16
c''16
b'16
a'16-4
g'16
f'16\!
  e'8^\finger "(1)"\< s1*1/8
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  < d c' >4_\finger "(51)"-.
r4
r4
< d b >4_4-.
  < c c' >4_\finger "(51)"-.
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
