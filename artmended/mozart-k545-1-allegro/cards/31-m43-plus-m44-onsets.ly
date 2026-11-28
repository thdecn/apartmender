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
  \mark \markup { \box \bold "m. 43" }
  e''4.-1_>
f''16
g''16
f''4)
r4
  d'''2-3(_>
  \bar "|."
}

lowerCard = {
  \clef "treble"
  \key c \major
  \time 4/4
  g'8-4
c''8-1
bes'8-2
c''8
f'8-5
c''8-1
a'8-3
c''8
  f'8_\finger "(5)" s1*3/8
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
