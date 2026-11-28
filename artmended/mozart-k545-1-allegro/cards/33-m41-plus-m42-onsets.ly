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
  \mark \markup { \box \bold "m. 41" }
  \break
r16
bes'16-3
d''16
c''16
bes'16
a'16
g'16
f'16-3
e'16\>
f'16-1
g'16
a'16
bes'16
c''16-1
d''16
e''16\!
  \override PhrasingSlur.direction = #1

f''2-1(\mp
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  d2_\finger "(4)"\sf)
< c g bes >2\sf
  \clef "treble"

f'8-5(\p s1*3/8
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
