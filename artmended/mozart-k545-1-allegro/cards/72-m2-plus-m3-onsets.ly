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
  \mark \markup { \box \bold "m. 2" }
  b'4.-1_>
c''16
d''16
c''4)
r4
  a''2-3(_>
  \bar "|."
}

lowerCard = {
  \clef treble
  \key c \major
  \time 4/4
  d'8-4
g'8-1
f'8-2
g'8
c'8-5
g'8-1
e'8-3
g'8
  c'8_\finger "(5)" s1*3/8
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
